import test from "node:test";
import assert from "node:assert/strict";
import { buildDocumentAnalysisRequest, extractJsonObject } from "../src/lib/geminiRequests.js";

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
});

test("extracts a JSON object from fenced Gemini text", () => {
  const parsed = extractJsonObject('```json\n{"title":"Demo","pages":[]}\n```');

  assert.deepEqual(parsed, { title: "Demo", pages: [] });
});
