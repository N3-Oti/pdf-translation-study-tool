import test from "node:test";
import assert from "node:assert/strict";
import { buildDocumentAnalysisRequest, buildTranslationRequest, extractJsonObject } from "../src/lib/geminiRequests.js";

test("builds a document analysis request that references the uploaded PDF file", () => {
  const request = buildDocumentAnalysisRequest({
    fileUri: "https://generativelanguage.googleapis.com/v1beta/files/abc",
    mimeType: "application/pdf",
    targetLanguage: "Japanese",
  });

  assert.equal(request.contents[0].parts[0].file_data.file_uri, "https://generativelanguage.googleapis.com/v1beta/files/abc");
  assert.equal(request.contents[0].parts[0].file_data.mime_type, "application/pdf");
  assert.match(request.contents[0].parts[1].text, /Document Model/);
  assert.match(request.contents[0].parts[1].text, /Learning Tables/);
  assert.match(request.contents[0].parts[1].text, /Preserved Terms/);
  assert.match(request.contents[0].parts[1].text, /bullet_list/);
  assert.match(request.contents[0].parts[1].text, /Do not collapse a page or section into one long paragraph/);
});

test("builds a translation request that preserves readable document structure", () => {
  const request = buildTranslationRequest({
    targetLanguage: "Japanese",
    segment: {
      pages: [
        {
          pageNumber: 1,
          blocks: [
            { id: "p1-b1", type: "paragraph", text: "First paragraph.\nSecond line." },
            { id: "p1-list1", type: "bullet_list", items: ["Keep structure"] },
          ],
        },
      ],
      preservedTerms: [],
    },
  });

  const prompt = request.contents[0].parts[0].text;
  assert.match(prompt, /list item/);
  assert.match(prompt, /Do not merge multiple paragraphs/);
  assert.match(prompt, /intentional line breaks/);
});

test("extracts a JSON object from fenced Gemini text", () => {
  const parsed = extractJsonObject('```json\n{"title":"Demo","pages":[]}\n```');

  assert.deepEqual(parsed, { title: "Demo", pages: [] });
});
