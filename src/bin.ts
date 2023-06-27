#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { removeWatermark } from "./index.js";

const args = yargs(hideBin(process.argv))
  .options({
    file: { type: "string", alias: "f", demandOption: true },
    watermark: { type: "string", alias: "w", demandOption: true },
    output: { type: "string", alias: "o" },
    binaryStringReplacement: {
      type: "boolean",
      description:
        "Strategy: Search through PDF for watermark characters and replace with spaces - unintelligent, just raw binary output search and replace",
      default: true,
    },
    modifyJsonObjects: {
      type: "boolean",
      description:
        "Strategy: Decompose PDF into JSON objects using qpdf and modify the objects by simply omitting stream lines that contain watermark",
      default: true,
    },
    omitStreamsWithWatermark: {
      type: "boolean",
      description:
        "Strategy: Decompose PDF into JSON objects using qpdf, and omit any stream that contains the watermark entirely",
      default: true,
    },
    casePermutations: {
      type: "boolean",
      alias: "c",
      description:
        "Attempt to check different case permutations of the watermark, e.g. 'CONFIDENTIAL' and 'confidential'",
      default: true,
    },
    removeMetadata: {
      type: "boolean",
      alias: "m",
      description: "Attempt to remove metadata - requires exiftool installed",
      default: true,
    },
  })
  .parseSync();

const {
  file,
  watermark,
  casePermutations,
  output,
  omitStreamsWithWatermark,
  binaryStringReplacement,
  modifyJsonObjects,
  removeMetadata,
} = args;

(async () => {
  try {
    const outputPath = await removeWatermark(file, {
      watermark,
      outputFileName: output,
      modifyJsonObjects,
      binaryStringReplacement,
      omitStreamsWithWatermark,
      casePermutations,
      removeMetadata,
    });
    console.log(`Output file: ${outputPath}`);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
})();
