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
    generationConfig: jsonGenerationConfig(documentModelSchema()),
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
    generationConfig: jsonGenerationConfig(translationSegmentSchema()),
  };
}

export function extractJsonObject(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const source = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(source);
  } catch (error) {
    const extracted = extractFirstJsonObject(source);
    if (!extracted) {
      throw error;
    }
    return JSON.parse(extracted);
  }
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
        { "id": "p{page}-list{n}", "type": "bullet_list" | "ordered_list", "items": string[] },
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
- Preserve the reading structure: headings, paragraphs, bullet lists, numbered lists, and tables must be separate blocks.
- Do not collapse a page or section into one long paragraph.
- Keep semantic paragraph breaks. Do not preserve accidental PDF line wraps inside a sentence.
- Preserve page numbers and stable Page Block ids.
- Return valid JSON only.`;
}

function translationPrompt(segment, targetLanguage) {
  return `Translate this Translation Segment to ${targetLanguage} and return only JSON.

Rules:
- Preserve every Page Block id exactly.
- Preserve every Preserved Term exactly in source-language spelling.
- Translate paragraph, heading, list item, table caption, table header, and table cell text.
- Do not translate text inside embedded figures.
- Keep the same JSON shape for pages and blocks.
- Preserve the block structure exactly. Do not merge multiple paragraphs, headings, lists, or tables into one text field.
- If a source block contains intentional line breaks, keep those line breaks in the translated text.

Preserved Terms:
${JSON.stringify(segment.preservedTerms || [], null, 2)}

Translation Segment:
${JSON.stringify({ pages: segment.pages || [] }, null, 2)}`;
}

function extractFirstJsonObject(source) {
  const start = source.indexOf("{");
  if (start < 0) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return "";
}

function jsonGenerationConfig(schema) {
  return {
    responseFormat: {
      text: {
        mimeType: "application/json",
        schema,
      },
    },
  };
}

function documentModelSchema() {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      targetLanguage: { type: "string" },
      pages: {
        type: "array",
        items: pageSchema(),
      },
      preservedTerms: {
        type: "array",
        items: preservedTermSchema(),
      },
      embeddedFigureCount: { type: "integer" },
    },
    required: ["title", "targetLanguage", "pages", "preservedTerms", "embeddedFigureCount"],
  };
}

function translationSegmentSchema() {
  return {
    type: "object",
    properties: {
      pages: {
        type: "array",
        items: pageSchema(),
      },
    },
    required: ["pages"],
  };
}

function pageSchema() {
  return {
    type: "object",
    properties: {
      pageNumber: { type: "integer" },
      blocks: {
        type: "array",
        items: blockSchema(),
      },
    },
    required: ["pageNumber", "blocks"],
  };
}

function blockSchema() {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      type: {
        type: "string",
        enum: ["heading", "paragraph", "bullet_list", "ordered_list", "learning_table", "embedded_figure"],
      },
      level: { type: "integer" },
      text: { type: "string" },
      items: {
        type: "array",
        items: { type: "string" },
      },
      caption: { type: "string" },
      headers: {
        type: "array",
        items: { type: "string" },
      },
      rows: {
        type: "array",
        items: {
          type: "array",
          items: { type: "string" },
        },
      },
      alt: { type: "string" },
    },
    required: ["id", "type"],
  };
}

function preservedTermSchema() {
  return {
    type: "object",
    properties: {
      term: { type: "string" },
      explanation: { type: "string" },
      appearances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            pageNumber: { type: "integer" },
            blockId: { type: "string" },
          },
          required: ["pageNumber", "blockId"],
        },
      },
    },
    required: ["term", "explanation", "appearances"],
  };
}
