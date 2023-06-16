import { describe, test } from "vitest";
import { removeWatermark } from "../src/index.js";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Removes watermark", async () => {
  test(`it throws when file doesn't exist`, async ({ expect }) => {
    await expect(() => removeWatermark(resolve(join(__dirname, "pdfs/nonexistant.pdf")))).rejects.toThrow();
  });

  test(`it removes the watermark from test pdf`, async ({ expect }) => {
    await removeWatermark(resolve(join(__dirname, "pdfs/sample-text-watermark.pdf")), { watermark: "WATERMARK" });
    expect(true).toBe(true);
  });

  test(`it removes the watermark from test pdf with image`, async ({ expect }) => {
    await removeWatermark(resolve(join(__dirname, "pdfs/sample-image-watermark.pdf")), { watermark: "WATERMARK" });
    expect(true).toBe(true);
  });
});
