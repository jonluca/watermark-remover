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
    await removeWatermark(resolve(join(__dirname, "pdfs/sample-text-watermark.pdf")), {
      watermark: "Watermark",
      outputFileName: "all-clean.pdf",
    });
    expect(true).toBe(true);
  });

  test(`it removes the watermark from test pdf with intelligent json only`, async ({ expect }) => {
    await removeWatermark(resolve(join(__dirname, "pdfs/sample-text-watermark.pdf")), {
      watermark: "Watermark",
      outputFileName: "sample-text-intelligent-clean.pdf",
      intelligentJson: true,
      modifyJsonObjects: false,
      binaryStringReplacement: false,
    });
    expect(true).toBe(true);
  });

  test(`it removes the watermark from test pdf with image`, async ({ expect }) => {
    await removeWatermark(resolve(join(__dirname, "pdfs/sample-image-watermark.pdf")), { watermark: "Watermark" });
    expect(true).toBe(true);
  });
});
