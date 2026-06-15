export function mergeTranslatedSegments(documentModel, translatedSegments) {
  const translatedPages = new Map();

  for (const segment of translatedSegments) {
    for (const page of segment.pages || []) {
      translatedPages.set(page.pageNumber, page);
    }
  }

  return {
    ...documentModel,
    pages: (documentModel.pages || []).map((page) => translatedPages.get(page.pageNumber) || page),
  };
}
