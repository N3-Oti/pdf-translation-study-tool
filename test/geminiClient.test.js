import test from "node:test";
import assert from "node:assert/strict";
import { listGeminiModels } from "../src/lib/geminiClient.js";

test("lists generateContent Gemini models while excluding TTS and Live models", async () => {
  const urls = [];
  const models = await listGeminiModels({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      urls.push(String(url));
      return {
        ok: true,
        async json() {
          return {
            models: [
              {
                name: "models/gemini-3.5-flash",
                baseModelId: "gemini-3.5-flash",
                displayName: "Gemini 3.5 Flash",
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/gemini-2.5-flash-preview-tts",
                baseModelId: "gemini-2.5-flash-preview-tts",
                displayName: "Gemini TTS",
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/gemini-live-2.5-flash-preview",
                baseModelId: "gemini-live-2.5-flash-preview",
                displayName: "Gemini Live",
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/text-embedding-004",
                baseModelId: "text-embedding-004",
                displayName: "Text Embedding",
                supportedGenerationMethods: ["embedContent"],
              },
            ],
          };
        },
      };
    },
  });

  assert.equal(urls[0], "https://generativelanguage.googleapis.com/v1beta/models?key=test-key&pageSize=1000");
  assert.deepEqual(models.map((model) => model.id), ["gemini-3.5-flash"]);
  assert.equal(models[0].displayName, "Gemini 3.5 Flash");
});
