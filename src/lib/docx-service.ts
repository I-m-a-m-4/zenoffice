// @ts-ignore
import * as mammothNamespace from 'mammoth';
// @ts-ignore
import * as docxPreviewNamespace from 'docx-preview';

const mammoth: any = (mammothNamespace as any)?.default || mammothNamespace;
const docxPreview: any = (docxPreviewNamespace as any)?.default || docxPreviewNamespace;

export interface DocxParseResult {
  html: string;
  text: string;
  messages: string[];
}

/**
 * Converts a base64 Data URL, string, or ArrayBuffer into an ArrayBuffer
 */
export function dataUrlToArrayBuffer(dataOrBuffer: string | ArrayBuffer): ArrayBuffer {
  if (dataOrBuffer instanceof ArrayBuffer) return dataOrBuffer;
  
  let base64 = dataOrBuffer;
  if (dataOrBuffer.includes(',')) {
    base64 = dataOrBuffer.split(',')[1];
  }

  try {
    const binaryString = atob(base64.trim());
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (err) {
    console.error('Failed to decode base64 string for DOCX', err);
    throw new Error('Invalid base64 DOCX encoding');
  }
}

/**
 * Renders DOCX with pixel-perfect Microsoft Word / WPS Office fidelity (A4 pages, headers, footers, logos, tables)
 * into a target container element and makes content directly selectable and editable.
 */
export async function renderDocxToElement(
  dataOrBuffer: string | ArrayBuffer,
  container: HTMLElement
): Promise<{ pageCount: number; rawText: string }> {
  const arrayBuffer = dataUrlToArrayBuffer(dataOrBuffer);

  // Clear previous contents
  container.innerHTML = '';

  // Render using docx-preview with full layout features enabled
  await docxPreview.renderAsync(arrayBuffer, container, undefined, {
    className: 'zen-wps-docx',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    debug: false,
    experimental: true,
    trimXmlDeclaration: true,
    ignoreLastRenderedPageBreak: false,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    useBase64URL: true,
    renderAltChunks: true,
  });

  // Make all rendered text, sections, and paragraphs contenteditable and selectable
  const editableTargets = container.querySelectorAll(
    'section.zen-wps-docx, .zen-wps-docx-wrapper, .zen-wps-docx article, .zen-wps-docx p, .zen-wps-docx h1, .zen-wps-docx h2, .zen-wps-docx h3, .zen-wps-docx table, .zen-wps-docx td, .zen-wps-docx th, .zen-wps-docx span'
  );

  editableTargets.forEach((node) => {
    const el = node as HTMLElement;
    el.contentEditable = 'true';
    el.style.userSelect = 'text';
    (el.style as any).webkitUserSelect = 'text';
    el.classList.add('select-text', 'cursor-text');
  });

  const pages = container.querySelectorAll('section.zen-wps-docx');
  const rawText = container.innerText || '';

  return {
    pageCount: Math.max(1, pages.length),
    rawText,
  };
}

/**
 * Converts a base64 Data URL or ArrayBuffer of a DOCX file into clean, editable HTML.
 */
export async function parseDocxToHtml(dataOrBuffer: string | ArrayBuffer): Promise<DocxParseResult> {
  const arrayBuffer = dataUrlToArrayBuffer(dataOrBuffer);

  // Mammoth conversion options: support embedded images, tables, headings
  const options = {
    convertImage: mammoth.images.imgElement((image: any) => {
      return image.read('base64').then((imageBuffer: string) => {
        return {
          src: `data:${image.contentType};base64,${imageBuffer}`,
        };
      });
    }),
  };

  try {
    const result = await mammoth.convertToHtml({ arrayBuffer }, options);
    const rawTextResult = await mammoth.extractRawText({ arrayBuffer });

    let cleanHtml = result.value || '';
    cleanHtml = enhanceDocxHtml(cleanHtml);

    return {
      html: cleanHtml,
      text: rawTextResult.value || '',
      messages: (result.messages || []).map((m: any) => m.message || String(m)),
    };
  } catch (error) {
    console.error('Mammoth failed to parse DOCX:', error);
    throw error;
  }
}

/**
 * Enhances the converted HTML with beautiful, editable styling for ZenOffice
 */
function enhanceDocxHtml(html: string): string {
  if (!html || !html.trim()) {
    return '<p><br/></p>';
  }

  // Add rich table styling classes and border attributes if not present
  let enhanced = html
    .replace(/<table>/gi, '<table class="zen-docx-table" style="width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: 13px; border: 1px solid #d4d4d8;">')
    .replace(/<th>/gi, '<th style="padding: 8px 12px; border: 1px solid #d4d4d8; background-color: #f4f4f5; text-align: left; font-weight: 600;">')
    .replace(/<td>/gi, '<td style="padding: 8px 12px; border: 1px solid #e4e4e7;">')
    .replace(/<blockquote>/gi, '<blockquote style="border-left: 4px solid #ea580c; padding-left: 1rem; margin: 1rem 0; color: #52525b; font-style: italic;">')
    .replace(/<img /gi, '<img style="max-width: 100%; height: auto; border-radius: 4px; margin: 0.75rem 0;" ');

  return enhanced;
}

/**
 * Exports HTML content as a Microsoft Word-compatible document (.doc / .docx)
 * Using the official Word HTML MIME format with XML namespaces for 100% fidelity.
 */
export function exportHtmlToWordDocument(htmlContent: string, filename: string = 'document.doc') {
  const cleanFilename = filename.endsWith('.doc') || filename.endsWith('.docx')
    ? filename.replace(/\.docx?$/, '.doc')
    : `${filename}.doc`;

  const wordDocumentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${cleanFilename}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: 8.5in 11in;
          margin: 1.0in 1.0in 1.0in 1.0in;
        }
        body {
          font-family: 'Times New Roman', 'Calibri', 'Arial', sans-serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #18181b;
        }
        h1 { font-size: 20pt; font-weight: bold; color: #18181b; margin-bottom: 8pt; text-align: center; }
        h2 { font-size: 15pt; font-weight: bold; color: #18181b; margin-top: 12pt; margin-bottom: 6pt; }
        h3 { font-size: 13pt; font-weight: bold; color: #27272a; margin-top: 10pt; margin-bottom: 4pt; }
        p { margin-bottom: 6pt; text-align: justify; }
        table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
        th, td { border: 1px solid #d4d4d8; padding: 6pt 8pt; }
        th { background-color: #f4f4f5; font-weight: bold; }
        blockquote { border-left: 3pt solid #ea580c; padding-left: 10pt; font-style: italic; color: #52525b; margin: 8pt 0; }
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const blob = new Blob([wordDocumentHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = cleanFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
