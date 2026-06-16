const DEFAULT_PAGES_PER_TRANSLATION_SEGMENT = 4;

export function createTranslationSegments(documentModel, options = {}) {
  const pagesPerSegment = Math.max(1, Number(options.pagesPerSegment || DEFAULT_PAGES_PER_TRANSLATION_SEGMENT));
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
