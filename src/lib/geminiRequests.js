export const DEFAULT_MODEL = "gemini-3.5-flash";

export function buildDocumentAnalysisRequest({ fileUri, mimeType, targetLanguage }) {
  return {
    contents: [
      {
        parts: [
          {
            file_data: {
              mime_type: mimeType || "application/pdf",
              file_uri: fileUri,
            },
          },
          {
            text: documentAnalysisPrompt(targetLanguage || "Japanese"),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };
}

export function buildTranslationRequest({ segment, targetLanguage }) {
  return {
    contents: [
      {
        parts: [
          {
            text: translationPrompt(segment, targetLanguage || "Japanese"),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };
}

export function extractJsonObject(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function extractGeminiText(response) {
  return response?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

function documentAnalysisPrompt(targetLanguage) {
  return `Analyze the uploaded source PDF and return only a JSON Document Model.

The target language is ${targetLanguage}.

Create a Document Model with this shape:
{
  "title": string,
  "targetLanguage": string,
  "pages": [
    {
      "pageNumber": number,
      "blocks": [
        { "id": "p{page}-b{n}", "type": "heading", "level": 1 | 2 | 3, "text": string },
        { "id": "p{page}-b{n}", "type": "paragraph", "text": string },
        { "id": "p{page}-t{n}", "type": "learning_table", "caption": string, "headers": string[], "rows": string[][] },
        { "id": "p{page}-img{n}", "type": "embedded_figure", "caption": string, "alt": string }
      ]
    }
  ],
  "preservedTerms": [
    {
      "term": string,
      "explanation": string,
      "appearances": [{ "pageNumber": number, "blockId": string }]
    }
  ],
  "embeddedFigureCount": number
}

Rules:
- Identify Preserved Terms from this PDF only. Do not use a fixed glossary list.
- Keep Preserved Terms in the source language.
- Generate Japanese glossary explanations in the PDF's own context.
- Reconstruct Learning Tables as meaningful rows and columns. Exact PDF styling is secondary.
- Include Embedded Figures only when they are available as image objects or clear figure references in the source PDF.
- Preserve page numbers and stable Page Block ids.
- Return valid JSON only.`;
}

function translationPrompt(segment, targetLanguage) {
  return `Translate this Translation Segment to ${targetLanguage} and return only JSON.

Rules:
- Preserve every Page Block id exactly.
- Preserve every Preserved Term exactly in source-language spelling.
- Translate paragraph, heading, table caption, table header, and table cell text.
- Do not translate text inside embedded figures.
- Keep the same JSON shape for pages and blocks.

Preserved Terms:
${JSON.stringify(segment.preservedTerms || [], null, 2)}

Translation Segment:
${JSON.stringify({ pages: segment.pages || [] }, null, 2)}`;
}
