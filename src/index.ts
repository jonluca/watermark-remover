import jetpack from "fs-jetpack";
import { execa } from "execa";
import { v4 as uuid } from "uuid";
import * as path from "path";
import { lookPath } from "find-bin";

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

export interface RemoveWatermarkOptions {
  watermark?: string;
  outputFile?: string;
}
export const removeWatermark = async (inputFile: string, opts?: RemoveWatermarkOptions) => {
  const watermark = opts?.watermark || "CONFIDENTIAL";

  // if file doesn't exist, return
  const resolved = path.resolve(inputFile);
  if (!jetpack.exists(resolved)) {
    throw new Error("File does not exist");
  }

  const qpdfBin = await lookPath("qpdf");
  if (!qpdfBin) {
    throw new Error("qpdf not found");
  }

  const dir = jetpack.tmpDir();
  try {
    const filename = path.basename(resolved);
    const fullPath = dir.path(filename);
    const parsedFilePath = path.parse(fullPath);
    jetpack.copy(resolved, fullPath);
    const file = dir.list()![0];
    if (!file) {
      throw new Error("Error copying file");
    }
    const name = uuid();
    const fullOutputPath = dir.path(name);
    const parseResult = await execa("qpdf", ["--json", "--json-stream-data=file", fullPath, fullOutputPath]);
    if (parseResult.exitCode !== 0) {
      throw new Error("Error executing qpdf");
    }
    const fileList = dir.list()?.filter((f) => f.startsWith(name)) || [];
    await Promise.allSettled(fileList.map((f) => cleanWatermarkFromFile(dir.path(f), watermark)));
    // replace file name, keeping extension

    const outputFileName = opts?.outputFile || `${parsedFilePath.name}-clean${parsedFilePath.ext}`;
    const dirname = path.dirname(resolved);
    const output = path.join(dirname, outputFileName);

    const tmpOutput = dir.path(outputFileName);
    const combineResult = await execa("qpdf", ["--json-input", fullOutputPath, tmpOutput]);
    if (combineResult.exitCode !== 0) {
      throw new Error("Error executing qpdf");
    }
    jetpack.copy(tmpOutput, output, { overwrite: true });
  } catch (e) {
    throw e;
  } finally {
    dir.remove();
  }
};
