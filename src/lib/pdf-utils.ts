import { PDFDocument, rgb, degrees } from 'pdf-lib';

/**
 * Merges multiple PDFs into a single PDF document.
 * @param pdfBytesArray Array of PDF files as Uint8Arrays
 * @returns Uint8Array of the merged PDF
 */
export async function mergePdfs(pdfBytesArray: Uint8Array[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  for (const pdfBytes of pdfBytesArray) {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  return await mergedPdf.save();
}

/**
 * Splits a PDF into a new PDF containing only the specified page range.
 * @param pdfBytes The source PDF
 * @param startPage 1-indexed start page
 * @param endPage 1-indexed end page
 * @returns Uint8Array of the split PDF
 */
export async function splitPdf(pdfBytes: Uint8Array, startPage: number, endPage: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const splitPdfDoc = await PDFDocument.create();
  
  // Convert to 0-indexed and ensure bounds
  const startIdx = Math.max(0, startPage - 1);
  const endIdx = Math.min(pdfDoc.getPageCount() - 1, endPage - 1);
  
  if (startIdx > endIdx) {
    throw new Error('Invalid page range');
  }

  const indices = [];
  for (let i = startIdx; i <= endIdx; i++) {
    indices.push(i);
  }

  const copiedPages = await splitPdfDoc.copyPages(pdfDoc, indices);
  copiedPages.forEach((page) => splitPdfDoc.addPage(page));
  
  return await splitPdfDoc.save();
}

/**
 * Adds a text watermark to all pages of a PDF.
 * @param pdfBytes The source PDF
 * @param text The watermark text
 * @returns Uint8Array of the watermarked PDF
 */
export async function watermarkPdf(pdfBytes: Uint8Array, text: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  
  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 2 - (text.length * 15) / 2, // Approximate centering
      y: height / 2,
      size: 50,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.5,
      rotate: degrees(45),
    });
  }
  
  return await pdfDoc.save();
}

// Note: pdf-lib's support for encryption/password protection is somewhat limited in standard open source builds.
// They support encrypting in standard but we'll include a placeholder or basic wrapper here if available, 
// otherwise we will document limitations.
