// Type declarations for 'colorsbymax/pdf'.

/**
 * Loads PDF.js for PDF uploads. Pass it as `pdf` in the ThemeProvider config; needs the
 * pdfjs-dist package installed. PDF.js downloads only when a visitor picks a PDF.
 */
export function loadPdf(): Promise<unknown>
