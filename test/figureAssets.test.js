import test from "node:test";
import assert from "node:assert/strict";
import { attachFigurePageSnapshots } from "../src/lib/figureAssets.js";

test("attaches page snapshot images to embedded figure blocks", () => {
  const documentModel = {
    pages: [
      {
        pageNumber: 2,
        blocks: [
          { id: "p2-b1", type: "paragraph", text: "本文" },
          { id: "p2-img1", type: "embedded_figure", caption: "Figure 1" },
        ],
      },
    ],
  };

  const result = attachFigurePageSnapshots(documentModel, new Map([[2, "data:image/png;base64,page2"]]));

  assert.equal(result.pages[0].blocks[1].dataUrl, "data:image/png;base64,page2");
  assert.equal(result.embeddedFigureCount, 1);
});
