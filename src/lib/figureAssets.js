const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.mjs";

let pdfjsPromise;

export async function renderPdfPageSnapshots(file, options = {}) {
  const pdfjsLib = options.pdfjsLib || (await loadPdfJs());
  const scale = Number(options.scale || 1.35);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const snapshots = new Map();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
    snapshots.set(pageNumber, canvas.toDataURL("image/png"));
  }

  return snapshots;
}

export function attachFigurePageSnapshots(documentModel, pageSnapshots) {
  let attachedCount = 0;
  const pages = (documentModel.pages || []).map((page) => {
    const pageSnapshot = pageSnapshots.get(page.pageNumber);
    const blocks = (page.blocks || []).map((block) => {
      if (block.type !== "embedded_figure" || block.dataUrl || !pageSnapshot) {
        return block;
      }

      attachedCount += 1;
      return {
        ...block,
        dataUrl: pageSnapshot,
        alt: block.alt || block.caption || `Embedded figure on page ${page.pageNumber}`,
      };
    });

    return { ...page, blocks };
  });

  return {
    ...documentModel,
    pages,
    embeddedFigureCount: attachedCount,
  };
}

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL).then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjsLib;
    });
  }

  return pdfjsPromise;
}
