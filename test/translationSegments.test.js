import test from "node:test";
import assert from "node:assert/strict";
import { createTranslationSegments } from "../src/lib/translationSegments.js";

test("creates page-based translation segments without losing block identifiers", () => {
  const segments = createTranslationSegments(
    {
      pages: [
        { pageNumber: 1, blocks: [{ id: "p1-b1", type: "paragraph", text: "A" }] },
        { pageNumber: 2, blocks: [{ id: "p2-b1", type: "paragraph", text: "B" }] },
        { pageNumber: 3, blocks: [{ id: "p3-b1", type: "paragraph", text: "C" }] },
      ],
      preservedTerms: [{ term: "Harness", explanation: "足場一式" }],
    },
    { pagesPerSegment: 2 },
  );

  assert.equal(segments.length, 2);
  assert.deepEqual(
    segments.map((segment) => segment.pages.map((page) => page.pageNumber)),
    [[1, 2], [3]],
  );
  assert.equal(segments[0].pages[1].blocks[0].id, "p2-b1");
  assert.equal(segments[0].preservedTerms[0].term, "Harness");
});

test("uses larger default segments to reduce long-document request count", () => {
  const segments = createTranslationSegments({
    pages: Array.from({ length: 49 }, (_, index) => ({
      pageNumber: index + 1,
      blocks: [{ id: `p${index + 1}-b1`, type: "paragraph", text: "Text" }],
    })),
  });

  assert.equal(segments.length, 13);
  assert.deepEqual(
    segments.map((segment) => segment.pages.length),
    [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
  );
});
