import jetpack from "fs-jetpack";
import { execa } from "execa";
import { v4 as uuid } from "uuid";
import * as path from "path";
import { lookpath } from "find-bin";
import type { FSJetpack } from "fs-jetpack/types.js";
import { bufferToHex, replaceBuffer } from "./utils.js";
import type { QpdfConfig } from "./qpdf.js";
import { join } from "path";

interface Params {
  watermark: string;
  outputPath: string;
  dir: FSJetpack;
  casePermutations: boolean;
  debugDir?: boolean;
}

const cleanWatermarkFromFile = async (filePath: string, watermark: string, casePermutations: boolean) => {
  const content = await jetpack.readAsync(filePath, "utf8");
  if (!content) {
    throw new Error("Error reading file");
  }
  if (!content.includes(watermark)) {
    return;
  }
  const regex = new RegExp(watermark, "gi");
  const lines = content.split("\n");
  const newLines = casePermutations
    ? lines.filter((line) => !line.includes(watermark))
    : lines.filter((line) => !line.match(regex));
  const newContent = newLines.join("\n");
  await jetpack.writeAsync(filePath, newContent);
};

const cleanWatermarkFromFileHex = async (filePath: string, watermark: string) => {
  const content = await jetpack.readAsync(filePath, "buffer");
  if (!content) {
    throw new Error("Error reading file");
  }

  // first do a clean replace of the buffer in utf8
  const watermarkBuf = Buffer.from(watermark, "utf8");
  replaceBuffer(content, watermarkBuf);

  // now try and replace hex version of watermark - the mapping will sometimes be offset by entries in font space
  for (let i = 0; i < 100; i++) {
    for (let j = 0; j < watermarkBuf.length; j++) {
      watermarkBuf[j] = watermarkBuf[j] - 1; // subtract 1 from each byte
    }
    replaceBuffer(content, Buffer.from(watermarkBuf.toString("hex"), "utf8"));
    const paddedHex = bufferToHex(watermarkBuf);
    const pattern = Buffer.from(paddedHex, "utf8");
    replaceBuffer(content, pattern);
    const paddedHexUpper = paddedHex.toUpperCase();
    const patternUpper = Buffer.from(paddedHexUpper, "utf8");
    replaceBuffer(content, patternUpper);
  }

  // now try and replace hex version with padding
  await jetpack.writeAsync(filePath, content);
};

const removeWatermarkFromFileJsonTechnique = async ({
  outputPath,
  debugDir,
  watermark,
  dir,
  casePermutations,
}: Params) => {
  const name = debugDir ? "json" : uuid();
  const fullOutputPath = dir.path(name);
  const parseResult = await execa("qpdf", ["--json", "--json-stream-data=file", outputPath, fullOutputPath]);
  if (parseResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }
  const fileList = dir.list()?.filter((f) => f.startsWith(name)) || [];
  await Promise.allSettled(fileList.map((f) => cleanWatermarkFromFile(dir.path(f), watermark, casePermutations)));
  // replace file name, keeping extension
  const parsedFilePath = path.parse(outputPath);
  const outputName = debugDir ? "json-output" : uuid();
  const outputFileName = outputName + parsedFilePath.ext;
  const tmpOutput = dir.path(outputFileName);
  const combineResult = await execa("qpdf", ["--json-input", fullOutputPath, tmpOutput]);
  if (combineResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }
  return tmpOutput;
};

const doesFileObjContainWatermark = async ({
  filePath,
  watermark,
}: {
  filePath: string;
  watermark: string;
}): Promise<string | null> => {
  const content = await jetpack.readAsync(filePath, "utf8");
  if (!content) {
    throw new Error("Error reading file");
  }
  const regex = new RegExp(watermark, "gi");
  if (content.match(regex)) {
    return filePath;
  }
  const watermarkBuf = Buffer.from(watermark, "utf8");
  // now try and replace hex version of watermark - the mapping will sometimes be offset by entries in font space
  for (let i = 0; i < 100; i++) {
    for (let j = 0; j < watermarkBuf.length; j++) {
      watermarkBuf[j] = watermarkBuf[j] - 1; // subtract 1 from each byte
    }
    const hexWatermark = watermarkBuf.toString("hex");
    const regex = new RegExp(hexWatermark, "gi");
    if (content.match(regex)) {
      return filePath;
    }
    const paddedHex = bufferToHex(watermarkBuf);
    const paddexHexRegex = new RegExp(paddedHex, "gi");
    if (content.match(paddexHexRegex)) {
      return filePath;
    }
  }

  return null;
};
const removeWatermarkFromFileomitStreamsWithWatermarkTechnique = async ({
  debugDir,
  outputPath,
  watermark,
  dir,
}: Params) => {
  const name = debugDir ? "json-omission" : uuid();
  const fullOutputPath = dir.path(name);
  const parseResult = await execa("qpdf", [
    "--json",
    "--json-stream-data=file",
    "--decode-level=all",
    "--stream-data=uncompress",
    outputPath,
    fullOutputPath,
  ]);
  if (parseResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }
  const prefix = `${name}-`;
  const fileList = dir.list()?.filter((f) => f.startsWith(prefix)) || [];
  const filesWithWatermarkResults = await Promise.allSettled(
    fileList.map(async (f) => {
      const maybeFile = await doesFileObjContainWatermark({ filePath: dir.path(f), watermark });
      if (maybeFile) {
        return f;
      }
      return null;
    }),
  );
  const filesWithWatermark = filesWithWatermarkResults
    .map((r) => r.status === "fulfilled" && r.value)
    .filter(Boolean) as string[];

  // follows the following format
  const pdfConfig = (await jetpack.readAsync(fullOutputPath, "json")) as QpdfConfig;
  const objects = pdfConfig.qpdf[1];
  const pages = pdfConfig.pages;

  const objectsToFilter = Object.entries(objects)
    .filter(([_, value]) => {
      if ("stream" in value && "datafile" in value.stream) {
        const searchElement = path.parse(value.stream.datafile).name;
        return filesWithWatermark.includes(searchElement);
      }
      return null;
    })
    .flatMap((l) => [l[0], l[0].split(":")[1]]);
  const objSet = new Set(objectsToFilter);
  // now we want to recursively visit all objects and remove references to the objects we want to remove

  function searchItem(item: object) {
    Object.keys(item || {}).forEach((key) => {
      const k = key as keyof typeof item;
      const entry = item[k];
      if (Array.isArray(entry)) {
        const arr = entry as (string | object)[];
        (item[k] as any) = arr.filter((i) => !objSet.has(i as string));
        arr.forEach((i) => {
          if (typeof i === "object") {
            searchItem(i);
          }
        });
      } else if (typeof entry === "object") {
        searchItem(entry);
      } else if (typeof entry === "string" && objSet.has(entry as string)) {
        delete item[k];
      }
    });
  }
  for (const page of pages) {
    searchItem(page);
  }

  for (const key of Object.values(objects)) {
    searchItem(key);
  }
  const path1 = JSON.stringify(pdfConfig, null, 2);
  await jetpack.writeAsync(fullOutputPath, path1);
  // replace file name, keeping extension
  const parsedFilePath = path.parse(outputPath);
  const outputName = debugDir ? "json-omission-output" : uuid();
  const outputFileName = outputName + parsedFilePath.ext;
  const tmpOutput = dir.path(outputFileName);
  const combineResult = await execa("qpdf", ["--json-input", fullOutputPath, tmpOutput]);
  if (combineResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }
  return tmpOutput;
};
const preprocessFile = async ({ debugDir, outputPath, dir }: Params) => {
  const name = debugDir ? "preprocessed-qdf.pdf" : uuid();
  const fullOutputPath = dir.path(name);
  const parseResult = await execa("qpdf", [
    "--qdf",
    "--recompress-flate",
    "--decode-level=all",
    "--stream-data=uncompress",
    outputPath,
    fullOutputPath,
  ]);
  if (parseResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }

  return fullOutputPath;
};

const postprocessFile = async ({ debugDir, outputPath, dir }: Params) => {
  const name = debugDir ? "postprocessed-qdf.pdf" : uuid();
  const fullOutputPath = dir.path(name);
  const exifResult = await execa("exiftool", ["-all:all=", "-overwrite_original", outputPath]);
  if (exifResult.exitCode !== 0) {
    throw new Error("Error executing exiftool");
  }

  const parseResult = await execa("qpdf", ["--linearize", outputPath, fullOutputPath]);
  if (parseResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }

  return fullOutputPath;
};

const removeWatermarkFromFileUncompressionTechnique = async ({
  outputPath,
  casePermutations,
  watermark,
  dir,
  debugDir,
}: Params) => {
  const name = debugDir ? "binary-removal.pdf" : uuid();
  const uncompressedOutputPath = dir.path(name);
  const uncompressResult = await execa("qpdf", [
    "--decode-level=all",
    "--stream-data=uncompress",
    outputPath,
    uncompressedOutputPath,
  ]);
  if (uncompressResult.exitCode !== 0) {
    throw new Error("Error executing qpdf with uncompression");
  }

  await cleanWatermarkFromFileHex(uncompressedOutputPath, watermark);
  if (casePermutations) {
    // it's kinda hard to do case permutations with binaries, so we'll just do upper and lower
    // would be awesome to have a performant way to do this in a case insensitive way
    await cleanWatermarkFromFileHex(uncompressedOutputPath, watermark.toLowerCase());
    await cleanWatermarkFromFileHex(uncompressedOutputPath, watermark.toUpperCase());
  }
  const compressedOutput = dir.path(debugDir ? "binary-removal-output.pdf" : uuid());
  const compressResult = await execa("qpdf", [
    "--remove-unreferenced-resources=yes",
    "--linearize",
    "--stream-data=compress",
    uncompressedOutputPath,
    compressedOutput,
  ]);

  if (compressResult.exitCode !== 0) {
    throw new Error("Error executing qpdf with recompression");
  }
  return compressedOutput;
};

export interface RemoveWatermarkOptions {
  watermark?: string;
  outputFileName?: string;
  modifyJsonObjects?: boolean;
  omitStreamsWithWatermark?: boolean;
  binaryStringReplacement?: boolean;
  casePermutations?: boolean;
  removeMetadata?: boolean;
  debugDir?: boolean;
}
export const removeWatermark = async (inputFile: string, opts?: RemoveWatermarkOptions) => {
  const watermark = opts?.watermark || "CONFIDENTIAL";
  const {
    modifyJsonObjects = true,
    casePermutations = true,
    omitStreamsWithWatermark = true,
    binaryStringReplacement = true,
    removeMetadata = true,
    debugDir,
  } = opts || {};
  // if file doesn't exist, return
  const resolved = path.resolve(inputFile);
  if (!jetpack.exists(resolved)) {
    throw new Error("File does not exist");
  }

  const qpdfBin = await lookpath("qpdf");
  if (!qpdfBin) {
    throw new Error("qpdf binary not found, make sure it's installed on your system - https://github.com/qpdf/qpdf");
  }

  const debugPath = join(process.cwd(), "dbg");
  if (debugDir) {
    jetpack.dir(debugPath).remove();
  }
  const tmpDir = debugDir ? jetpack.dir(debugPath) : jetpack.tmpDir();

  try {
    const filename = path.basename(resolved);
    const fullPath = tmpDir.path(filename);
    jetpack.copy(resolved, fullPath, { overwrite: true });
    const file = tmpDir.list()![0];
    if (!file) {
      throw new Error("Error copying file");
    }
    const parsedFilePath = path.parse(fullPath);

    const outputFileName =
      opts?.outputFileName || (debugDir ? "output-final.pdf" : `${parsedFilePath.name}-clean${parsedFilePath.ext}`);
    const dirname = path.dirname(resolved);
    const output = path.join(debugDir ? debugPath : dirname, outputFileName);

    const outputPath = fullPath;

    const params = {
      watermark,
      outputPath,
      dir: tmpDir,
      casePermutations,
      debugDir,
    } as Params;

    params.outputPath = await preprocessFile(params);

    if (omitStreamsWithWatermark) {
      params.outputPath = await removeWatermarkFromFileomitStreamsWithWatermarkTechnique(params);
    }

    if (modifyJsonObjects) {
      params.outputPath = await removeWatermarkFromFileJsonTechnique(params);
    }

    if (binaryStringReplacement) {
      params.outputPath = await removeWatermarkFromFileUncompressionTechnique(params);
    }

    if (removeMetadata) {
      const exifBin = await lookpath("exiftool");
      if (!exifBin) {
        console.error("exiftool binary not found, make sure it's installed on your system - brew install exiftool");
      } else {
        params.outputPath = await postprocessFile(params);
      }
    }

    jetpack.copy(params.outputPath, output, { overwrite: true });
    return output;
  } finally {
    if (!debugDir) {
      tmpDir.remove();
    }
  }
};
