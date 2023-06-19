#!/usr/bin/env node

import { removeWatermark } from "../dist/index.js";

const filePath = process.argv[2];
const watermark = process.argv[3];

(async () => {
  await removeWatermark(filePath, { watermark: watermark });
})();
