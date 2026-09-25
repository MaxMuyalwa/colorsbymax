// Opt-in PDF support for "Palette from an image or PDF". Sites that want it install pdfjs-dist
// and pass this loader in the config:
//
//   import { loadPdf } from 'colorsbymax/pdf'
//   <ThemeProvider config={{ ..., pdf: loadPdf }}>
//
// Kept out of the main entry so sites without it never install or bundle PDF.js. Both imports
// stay dynamic, so PDF.js still downloads only when a visitor actually picks a PDF.

/** Loads PDF.js, running it on the page so there's no separate worker file to host. */
export async function loadPdf() {
  const pdfjs = await import('pdfjs-dist')
  await import('pdfjs-dist/build/pdf.worker.min.mjs')
  return pdfjs
}
