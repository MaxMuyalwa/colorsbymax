//#region src/pdf.js
/** Loads PDF.js, running it on the page so there's no separate worker file to host. */
async function loadPdf() {
	const pdfjs = await import("pdfjs-dist");
	await import("pdfjs-dist/build/pdf.worker.min.mjs");
	return pdfjs;
}
//#endregion
export { loadPdf };
