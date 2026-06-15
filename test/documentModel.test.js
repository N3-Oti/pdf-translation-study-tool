import test from "node:test";
import assert from "node:assert/strict";
import { mergeTranslatedSegments } from "../src/lib/documentModel.js";

test("merges translated pages back into the document model while keeping glossary data", () => {
  const merged = mergeTranslatedSegments(
    {
      title: "Source",
      targetLanguage: "ja",
      pages: [{ pageNumber: 1, blocks: [{ id: "p1-b1", text: "Source text" }] }],
      preservedTerms: [{ term: "Harness", explanation: "足場一式", appearances: [] }],
      embeddedFigureCount: 2,
    },
    [{ pages: [{ pageNumber: 1, blocks: [{ id: "p1-b1", text: "翻訳済み" }] }] }],
  );

  assert.equal(merged.pages[0].blocks[0].text, "翻訳済み");
  assert.equal(merged.preservedTerms[0].term, "Harness");
  assert.equal(merged.embeddedFigureCount, 2);
});
