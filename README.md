# Watermark Remover

[![npm Version](https://img.shields.io/npm/v/watermark-remover.svg)](https://www.npmjs.com/package/watermark-remover) [![License](https://img.shields.io/npm/l/watermark-remover.svg)](https://www.npmjs.com/package/watermark-remover)

Remove a watermark from a pdf

# Introduction

This only works for text based watermarks that have been added to the pdf as text. It will not work for images or other types of watermarks.

# Getting Started

You must have qpdf >v11 and exiftool (to remove metadata) installed. You can install it with brew on macos:

```
brew install qpdf exiftool
```

or with apt

```bash
sudo apt-get install qpdf exiftool
```

Then add this as a dependency

```
yarn add watermark-remover
```

or you can just run the binary with

```
npx watermark-remover -f file.pdf -w <WATERMARK TEXT>
```

# Usage

```typescript
import { removeWatermark } from "watermark-remover";

(async () => {
  const filePath = "my-file.pdf";
  const outputPath = "my-file-without-watermark.pdf";
  await removeWatermark(filePath, { watermark: "Confidential", outputFile: outputPath });
})();
```
