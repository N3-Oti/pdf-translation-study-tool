import {
  DEFAULT_MODEL,
  buildDocumentAnalysisRequest,
  buildTranslationRequest,
  extractGeminiText,
  extractJsonObject,
} from "./geminiRequests.js";

const BASE_URL = "https://generativelanguage.googleapis.com";

export async function uploadPdfToGemini({ apiKey, file, fetchImpl = fetch, onStatus = () => {} }) {
  onStatus("Preparing Gemini file upload...");
  const startResponse = await fetchImpl(`${BASE_URL}/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(file.size),
      "X-Goog-Upload-Header-Content-Type": file.type || "application/pdf",
    },
    body: JSON.stringify({ file: { display_name: file.name || "source.pdf" } }),
  });

  if (!startResponse.ok) {
    throw new Error(`Gemini upload start failed: ${startResponse.status}`);
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Gemini did not return an upload URL.");
  }

  onStatus("Uploading PDF to Gemini Files API...");
  const uploadResponse = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(file.size),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Gemini upload failed: ${uploadResponse.status}`);
  }

  const uploadJson = await uploadResponse.json();
  const geminiFile = uploadJson.file;
  if (!geminiFile?.name || !geminiFile?.uri) {
    throw new Error("Gemini upload response did not include a file reference.");
  }

  return waitForGeminiFile({ apiKey, file: geminiFile, fetchImpl, onStatus });
}

export async function waitForGeminiFile({ apiKey, file, fetchImpl = fetch, onStatus = () => {}, maxAttempts = 20 }) {
  let current = file;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (current.state && current.state !== "PROCESSING") {
      break;
    }

    onStatus(`Waiting for Gemini file processing (${attempt + 1}/${maxAttempts})...`);
    await delay(1500);
    const response = await fetchImpl(`${BASE_URL}/v1beta/${current.name}?key=${encodeURIComponent(apiKey)}`);
    if (!response.ok) {
      throw new Error(`Gemini file status failed: ${response.status}`);
    }
    current = await response.json();
  }

  if (current.state === "FAILED") {
    throw new Error("Gemini file processing failed.");
  }

  if (current.state === "PROCESSING") {
    throw new Error("Gemini file processing timed out.");
  }

  return current;
}

export async function analyzeDocument({ apiKey, fileReference, targetLanguage, fetchImpl = fetch, model = DEFAULT_MODEL }) {
  const response = await fetchImpl(
    `${BASE_URL}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildDocumentAnalysisRequest({
          fileUri: fileReference.uri,
          mimeType: fileReference.mimeType || fileReference.mime_type || "application/pdf",
          targetLanguage,
        }),
      ),
    },
  );

  return parseGeminiJsonResponse(response, "Document Analysis");
}

export async function translateSegment({ apiKey, segment, targetLanguage, fetchImpl = fetch, model = DEFAULT_MODEL }) {
  const response = await fetchImpl(
    `${BASE_URL}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTranslationRequest({ segment, targetLanguage })),
    },
  );

  return parseGeminiJsonResponse(response, `Translation Segment ${segment.index + 1}`);
}

async function parseGeminiJsonResponse(response, label) {
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`${label} failed: ${response.status} ${errorText}`.trim());
  }

  const json = await response.json();
  return extractJsonObject(extractGeminiText(json));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
