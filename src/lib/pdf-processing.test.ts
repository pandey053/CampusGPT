import { describe, expect, it } from "vitest";

import {
  extractPdfPages,
  getPdfDownloadDiagnostics,
} from "./pdf-processing";

function createTextPdf(): Uint8Array {
  const stream = "BT /F1 18 Tf 20 80 Td (Campus handbook text) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

describe("extractPdfPages", () => {
  it("rejects empty PDFs instead of treating them as successfully processed", async () => {
    await expect(extractPdfPages(new Uint8Array())).rejects.toThrow(
      "The PDF file is empty.",
    );
    expect(getPdfDownloadDiagnostics(new Uint8Array())).toMatchObject({
      byteLength: 0,
      hasPdfSignature: false,
      contentKind: "empty",
    });
  });

  it("rejects files without a PDF signature", async () => {
    const bytes = new TextEncoder().encode('{"error":"not a PDF"}');
    await expect(
      extractPdfPages(bytes),
    ).rejects.toThrow("valid PDF signature");
    expect(getPdfDownloadDiagnostics(bytes)).toMatchObject({
      hasPdfSignature: false,
      contentKind: "json",
    });
  });

  it("reports PDF.js parser details for a corrupt file with a PDF signature", async () => {
    await expect(
      extractPdfPages(new TextEncoder().encode("%PDF-this is not a valid PDF")),
    ).rejects.toThrow(/PDF.js could not open the stored PDF/);
  });

  it("parses a valid PDF and preserves its page text", async () => {
    await expect(extractPdfPages(createTextPdf())).resolves.toEqual([
      { pageNumber: 1, text: "Campus handbook text" },
    ]);
  });
});
