import test from "node:test";
import assert from "node:assert/strict";
import { assemblePortableHtml } from "../src/lib/portableHtml.js";

test("assembles a portable study HTML document with tables and glossary anchors", () => {
  const html = assemblePortableHtml({
    title: "Agentic Engineering Day 1",
    targetLanguage: "ja",
    pages: [
      {
        pageNumber: 8,
        blocks: [
          { id: "p8-b1", type: "heading", level: 1, text: "Vibe CodingからAgentic Engineeringへ" },
          { id: "p8-b2", type: "paragraph", text: "Vibe CodingはカジュアルなAI支援開発です。\n検証を強化します。" },
          { id: "p8-list1", type: "bullet_list", items: ["仕様を分ける", "テストで確認する"] },
          {
            id: "p8-t1",
            type: "learning_table",
            caption: "Spectrum",
            headers: ["Dimension", "Vibe Coding", "Agentic Engineering"],
            rows: [["Validation", "弱い", "テストと評価で確認する"]],
          },
        ],
      },
    ],
    preservedTerms: [
      {
        term: "Vibe Coding",
        explanation: "構造化や検証を伴わないカジュアルなAI支援開発手法。",
        appearances: [{ pageNumber: 8, blockId: "p8-b2" }],
      },
    ],
    embeddedFigures: [],
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /id="p8-b2"/);
  assert.match(html, /Vibe CodingはカジュアルなAI支援開発です。\n検証を強化します。/);
  assert.match(html, /<ul id="p8-list1" class="text-list">/);
  assert.match(html, /<li>仕様を分ける<\/li>/);
  assert.match(html, /white-space: pre-line/);
  assert.match(html, /<table/);
  assert.match(html, /Glossary &amp; Index/);
  assert.match(html, /href="#p8-b2"/);
  assert.match(html, /Vibe Coding/);
});
