export function createTranslationSegments(documentModel, options = {}) {
  const pagesPerSegment = Math.max(1, Number(options.pagesPerSegment || 2));
  const pages = documentModel.pages || [];
  const segments = [];

  for (let index = 0; index < pages.length; index += pagesPerSegment) {
    segments.push({
      index: segments.length,
      pages: pages.slice(index, index + pagesPerSegment),
      preservedTerms: documentModel.preservedTerms || [],
    });
  }

  return segments;
}
