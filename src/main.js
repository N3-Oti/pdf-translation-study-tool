import { uploadPdfToGemini, analyzeDocument, translateSegment } from "./lib/geminiClient.js";
import { loadDeviceSavedKey, persistGeminiKey } from "./lib/keyStorage.js";
import { createTranslationSegments } from "./lib/translationSegments.js";
import { mergeTranslatedSegments } from "./lib/documentModel.js";
import { assemblePortableHtml } from "./lib/portableHtml.js";
import { attachFigurePageSnapshots, renderPdfPageSnapshots } from "./lib/figureAssets.js";

const app = document.querySelector("#app");

const state = {
  portableHtml: "",
  running: false,
};

render();

function render() {
  app.innerHTML = `
    <section class="shell">
      <header class="topbar">
        <div>
          <h1>PDF Translation Study Tool</h1>
          <p>Gemini KeyでPDFを学習用の翻訳HTMLに変換します。</p>
        </div>
      </header>

      <form class="workspace" id="workflow">
        <section class="panel controls">
          <label class="field">
            <span>PDF</span>
            <input id="pdfFile" type="file" accept="application/pdf" required>
          </label>

          <label class="field">
            <span>翻訳先言語</span>
            <input id="targetLanguage" type="text" value="Japanese" list="targetLanguageSuggestions" placeholder="例: Japanese, Japanese for high school students, 簡体字中国語" required>
            <datalist id="targetLanguageSuggestions">
              <option value="Japanese"></option>
              <option value="English"></option>
              <option value="Korean"></option>
              <option value="Simplified Chinese"></option>
              <option value="Traditional Chinese"></option>
            </datalist>
          </label>

          <label class="field">
            <span>Gemini Key</span>
            <input id="geminiKey" type="password" autocomplete="off" placeholder="AIza..." value="${escapeAttribute(loadDeviceSavedKey())}" required>
          </label>

          <label class="check">
            <input id="saveKey" type="checkbox" ${loadDeviceSavedKey() ? "checked" : ""}>
            <span>この端末に保存</span>
          </label>

          <p class="note">Gemini KeyとPDFはこのブラウザからGemini APIへ送信されます。このアプリのサーバーには保存されません。</p>

          <button class="primary" id="startButton" type="submit" ${state.running ? "disabled" : ""}>変換を開始</button>
          <a class="secondary ${state.portableHtml ? "" : "disabled"}" id="downloadLink" download="translated-study.html">HTMLをダウンロード</a>
        </section>

        <section class="panel status-panel">
          <h2>処理ステータス</h2>
          <ol class="status-list" id="statusList">
            <li>PDFを選択してください。</li>
          </ol>
          <div class="summary" id="summary"></div>
        </section>

        <section class="panel preview-panel">
          <div class="preview-head">
            <h2>プレビュー</h2>
          </div>
          <iframe id="preview" title="Translated HTML preview"></iframe>
        </section>
      </form>
    </section>
  `;

  const workflow = document.querySelector("#workflow");
  const downloadLink = document.querySelector("#downloadLink");

  if (state.portableHtml) {
    downloadLink.href = makeDownloadUrl(state.portableHtml);
    document.querySelector("#preview").srcdoc = state.portableHtml;
  }

  workflow.addEventListener("submit", runWorkflow);
}

async function runWorkflow(event) {
  event.preventDefault();
  if (state.running) {
    return;
  }

  const pdfFile = document.querySelector("#pdfFile").files[0];
  const apiKey = document.querySelector("#geminiKey").value.trim();
  const targetLanguage = document.querySelector("#targetLanguage").value.trim();
  const shouldSaveKey = document.querySelector("#saveKey").checked;

  if (!pdfFile || !apiKey || !targetLanguage) {
    addStatus("PDF、Gemini Key、翻訳先言語を入力してください。", "error");
    return;
  }

  state.running = true;
  state.portableHtml = "";
  setRunning(true);
  clearStatus();

  try {
    persistGeminiKey(localStorage, apiKey, shouldSaveKey);
    addStatus("Gemini Keyの扱いを反映しました。");

    addStatus("PDFページ画像をブラウザ内で準備しています。");
    const pageSnapshots = await renderPdfPageSnapshots(pdfFile);
    addStatus(`${pageSnapshots.size}ページ分の画像を準備しました。`);

    const fileReference = await uploadPdfToGemini({
      apiKey,
      file: pdfFile,
      onStatus: addStatus,
    });
    addStatus("PDFアップロードが完了しました。");

    addStatus("Document Analysis Passを実行しています。");
    const documentModel = await analyzeDocument({ apiKey, fileReference, targetLanguage });
    addStatus("Document Modelを受信しました。");

    const segments = createTranslationSegments(documentModel, { pagesPerSegment: 2 });
    const translatedSegments = [];

    for (const segment of segments) {
      addStatus(`Translation Segment ${segment.index + 1}/${segments.length} を翻訳しています。`);
      translatedSegments.push(await translateSegment({ apiKey, segment, targetLanguage }));
    }

    const translatedDocument = mergeTranslatedSegments(
      {
        ...documentModel,
        targetLanguage: languageCode(targetLanguage),
      },
      translatedSegments,
    );

    const documentWithFigures = attachFigurePageSnapshots(translatedDocument, pageSnapshots);

    state.portableHtml = assemblePortableHtml(documentWithFigures);
    addStatus("Portable HTMLを生成しました。");
    showSummary(documentWithFigures);
    setPreview(state.portableHtml);
    setDownload(state.portableHtml);
  } catch (error) {
    console.error(error);
    addStatus(error.message || "変換に失敗しました。", "error");
  } finally {
    state.running = false;
    setRunning(false);
  }
}

function addStatus(message, type = "info") {
  const list = document.querySelector("#statusList");
  const item = document.createElement("li");
  item.className = type;
  item.textContent = message;
  list.append(item);
}

function clearStatus() {
  document.querySelector("#statusList").innerHTML = "";
  document.querySelector("#summary").textContent = "";
  document.querySelector("#preview").srcdoc = "";
  const link = document.querySelector("#downloadLink");
  link.removeAttribute("href");
  link.classList.add("disabled");
}

function showSummary(documentModel) {
  const pages = documentModel.pages?.length || 0;
  const terms = documentModel.preservedTerms?.length || 0;
  const figures = documentModel.embeddedFigureCount || countEmbeddedFigureBlocks(documentModel);
  document.querySelector("#summary").textContent = `${pages}ページ、Preserved Term ${terms}件、Embedded Figure ${figures}件を含むHTMLを生成しました。`;
}

function countEmbeddedFigureBlocks(documentModel) {
  return (documentModel.pages || []).reduce(
    (count, page) => count + (page.blocks || []).filter((block) => block.type === "embedded_figure").length,
    0,
  );
}

function setRunning(isRunning) {
  document.querySelector("#startButton").disabled = isRunning;
  document.querySelector("#startButton").textContent = isRunning ? "処理中..." : "変換を開始";
}

function setPreview(html) {
  document.querySelector("#preview").srcdoc = html;
}

function setDownload(html) {
  const link = document.querySelector("#downloadLink");
  link.href = makeDownloadUrl(html);
  link.classList.remove("disabled");
}

function makeDownloadUrl(html) {
  return URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
}

function languageCode(language) {
  const normalized = String(language || "").toLowerCase();
  if (normalized.includes("english") || normalized.includes("英語")) return "en";
  if (normalized.includes("korean") || normalized.includes("韓国語") || normalized.includes("朝鮮語")) return "ko";
  if (normalized.includes("chinese") || normalized.includes("中国語") || normalized.includes("中文")) return "zh";
  if (normalized.includes("japanese") || normalized.includes("日本語")) return "ja";
  return "ja";
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
