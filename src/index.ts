import jetpack from "fs-jetpack";
import { execa } from "execa";
import { v4 as uuid } from "uuid";
import * as path from "path";
import { lookpath } from "find-bin";
import type { FSJetpack } from "fs-jetpack/types.js";
import { bufferToHex, replaceBuffer } from "./utils.js";
import type { QpdfConfig } from "./qpdf.js";

const cleanWatermarkFromFile = async (filePath: string, watermark: string) => {
  const content = await jetpack.readAsync(filePath, "utf8");
  if (!content) {
    throw new Error("Error reading file");
  }
  if (!content.includes(watermark)) {
    return;
  }
  const lines = content.split("\n");
  const newLines = lines.filter((line) => !line.includes(watermark));
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

const removeWatermarkFromFileJsonTechnique = async (fullPath: string, watermark: string, dir: FSJetpack) => {
  const name = uuid();
  const fullOutputPath = dir.path(name);
  const parseResult = await execa("qpdf", ["--json", "--json-stream-data=file", fullPath, fullOutputPath]);
  if (parseResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }
  const fileList = dir.list()?.filter((f) => f.startsWith(name)) || [];
  await Promise.allSettled(fileList.map((f) => cleanWatermarkFromFile(dir.path(f), watermark)));
  // replace file name, keeping extension
  const parsedFilePath = path.parse(fullPath);
  const outputFileName = uuid() + parsedFilePath.ext;
  const tmpOutput = dir.path(outputFileName);
  const combineResult = await execa("qpdf", ["--json-input", fullOutputPath, tmpOutput]);
  if (combineResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }
  return tmpOutput;
};

const doesFileObjContainWatermark = async (filePath: string, watermark: string): Promise<string | null> => {
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
const removeWatermarkFromFileIntelligentJsonTechnique = async (fullPath: string, watermark: string, dir: FSJetpack) => {
  const name = uuid();
  const fullOutputPath = dir.path(name);
  const parseResult = await execa("qpdf", [
    "--json",
    "--json-stream-data=file",
    "--decode-level=all",
    fullPath,
    fullOutputPath,
  ]);
  if (parseResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }
  const prefix = `${name}-`;
  const fileList = dir.list()?.filter((f) => f.startsWith(prefix)) || [];
  const filesWithWatermarkResults = await Promise.allSettled(
    fileList.map(async (f) => {
      const maybeFile = await doesFileObjContainWatermark(dir.path(f), watermark);
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
  const parsedFilePath = path.parse(fullPath);
  const outputFileName = uuid() + parsedFilePath.ext;
  const tmpOutput = dir.path(outputFileName);
  const combineResult = await execa("qpdf", ["--json-input", fullOutputPath, tmpOutput]);
  if (combineResult.exitCode !== 0) {
    throw new Error("Error executing qpdf");
  }
  return tmpOutput;
};

const removeWatermarkFromFileUncompressionTechnique = async (inputFile: string, watermark: string, dir: FSJetpack) => {
  const name = uuid();
  const uncompressedOutputPath = dir.path(name);
  const uncompressResult = await execa("qpdf", [
    "--decode-level=all",
    "--stream-data=uncompress",
    inputFile,
    uncompressedOutputPath,
  ]);
  if (uncompressResult.exitCode !== 0) {
    throw new Error("Error executing qpdf with uncompression");
  }

  await cleanWatermarkFromFileHex(uncompressedOutputPath, watermark);
  const compressedOutput = dir.path(uuid());
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
  intelligentJson?: boolean;
  binaryStringReplacement?: boolean;
}
export const removeWatermark = async (inputFile: string, opts?: RemoveWatermarkOptions) => {
  const watermark = opts?.watermark || "CONFIDENTIAL";
  const { modifyJsonObjects = true, intelligentJson = true, binaryStringReplacement = true } = opts || {};
  // if file doesn't exist, return
  const resolved = path.resolve(inputFile);
  if (!jetpack.exists(resolved)) {
    throw new Error("File does not exist");
  }

  const qpdfBin = await lookpath("qpdf");
  if (!qpdfBin) {
    throw new Error("qpdf not found");
  }

  const tmpDir = jetpack.tmpDir();
  try {
    const filename = path.basename(resolved);
    const fullPath = tmpDir.path(filename);
    jetpack.copy(resolved, fullPath);
    const file = tmpDir.list()![0];
    if (!file) {
      throw new Error("Error copying file");
    }
    const parsedFilePath = path.parse(fullPath);

    const outputFileName = opts?.outputFileName || `${parsedFilePath.name}-clean${parsedFilePath.ext}`;
    const dirname = path.dirname(resolved);
    const output = path.join(dirname, outputFileName);
    let outputPath = fullPath;

    if (intelligentJson) {
      outputPath = await removeWatermarkFromFileIntelligentJsonTechnique(outputPath, watermark, tmpDir);
    }

    if (modifyJsonObjects) {
      outputPath = await removeWatermarkFromFileJsonTechnique(outputPath, watermark, tmpDir);
    }

    if (binaryStringReplacement) {
      outputPath = await removeWatermarkFromFileUncompressionTechnique(outputPath, watermark, tmpDir);
    }
    jetpack.copy(outputPath, output, { overwrite: true });
    return output;
  } finally {
    tmpDir.remove();
  }
};
