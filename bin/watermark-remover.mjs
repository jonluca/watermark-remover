#!/usr/bin/env node

import { removeWatermark } from "../dist/index.js";

const filePath = process.argv[2];
const watermark = process.argv[3];

(async () => {
  try {
    const outputPath = await removeWatermark(filePath, { watermark: watermark });
    console.log(`Output file: ${outputPath}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
})();
