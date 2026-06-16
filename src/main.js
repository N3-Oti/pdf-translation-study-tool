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
  uiLanguage: localStorage.getItem("uiLanguage") || "ja",
};

render();

function render() {
  const labels = uiText();
  const savedKey = loadDeviceSavedKey();

  app.innerHTML = `
    <section class="shell">
      <header class="topbar">
        <div>
          <h1>PDF Translation Study Tool</h1>
          <p>${labels.tagline}</p>
        </div>
        <label class="ui-language">
          <span>${labels.uiLanguage}</span>
          <select id="uiLanguage">
            <option value="ja" ${state.uiLanguage === "ja" ? "selected" : ""}>JA</option>
            <option value="en" ${state.uiLanguage === "en" ? "selected" : ""}>EN</option>
            <option value="ko" ${state.uiLanguage === "ko" ? "selected" : ""}>KR</option>
            <option value="zh-Hans" ${state.uiLanguage === "zh-Hans" ? "selected" : ""}>简中</option>
            <option value="zh-Hant" ${state.uiLanguage === "zh-Hant" ? "selected" : ""}>繁中</option>
          </select>
        </label>
      </header>

      <form class="workspace" id="workflow">
        <section class="panel controls">
          <label class="field">
            <span>PDF</span>
            <input id="pdfFile" type="file" accept="application/pdf" required>
          </label>

          <label class="field">
            <span>${labels.targetLanguage}</span>
            <input id="targetLanguage" type="text" value="Japanese" list="targetLanguageSuggestions" placeholder="${labels.targetLanguagePlaceholder}" required>
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
            <input id="geminiKey" type="password" autocomplete="off" placeholder="AIza..." value="${escapeAttribute(savedKey)}" required>
          </label>

          <label class="check">
            <input id="saveKey" type="checkbox" ${savedKey ? "checked" : ""}>
            <span>${labels.saveKey}</span>
          </label>

          <p class="note">${labels.privacyNote}</p>

          <button class="primary" id="startButton" type="submit" ${state.running ? "disabled" : ""}>${state.running ? labels.running : labels.start}</button>
          <a class="secondary ${state.portableHtml ? "" : "disabled"}" id="downloadLink" download="translated-study.html">${labels.download}</a>
        </section>

        <section class="panel status-panel">
          <h2>${labels.statusTitle}</h2>
          <ol class="status-list" id="statusList">
            <li>${labels.initialStatus}</li>
          </ol>
          <div class="summary" id="summary"></div>
        </section>

        <section class="panel preview-panel">
          <div class="preview-head">
            <h2>${labels.preview}</h2>
          </div>
          <iframe id="preview" title="Translated HTML preview"></iframe>
        </section>
      </form>
    </section>
  `;

  const workflow = document.querySelector("#workflow");
  const downloadLink = document.querySelector("#downloadLink");
  document.querySelector("#uiLanguage").addEventListener("change", (event) => {
    state.uiLanguage = event.target.value;
    localStorage.setItem("uiLanguage", state.uiLanguage);
    applyUiLanguage();
  });

  if (state.portableHtml) {
    downloadLink.href = makeDownloadUrl(state.portableHtml);
    document.querySelector("#preview").srcdoc = state.portableHtml;
  }

  workflow.addEventListener("submit", runWorkflow);
  document.documentElement.lang = state.uiLanguage;
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
    addStatus(uiText().missingInputs, "error");
    return;
  }

  state.running = true;
  state.portableHtml = "";
  setRunning(true);
  clearStatus();

  try {
    persistGeminiKey(localStorage, apiKey, shouldSaveKey);
    addStatus(uiText().keyApplied);

    addStatus(uiText().preparingSnapshots);
    const pageSnapshots = await renderPdfPageSnapshots(pdfFile);
    addStatus(uiText().snapshotsReady(pageSnapshots.size));

    const fileReference = await uploadPdfToGemini({
      apiKey,
      file: pdfFile,
      onStatus: addStatus,
    });
    addStatus(uiText().uploadComplete);

    addStatus(uiText().analysisRunning);
    const documentModel = await analyzeDocument({ apiKey, fileReference, targetLanguage });
    addStatus(uiText().analysisReceived);

    const segments = createTranslationSegments(documentModel);
    const translatedSegments = [];

    for (const segment of segments) {
      addStatus(uiText().translatingSegment(segment.index + 1, segments.length));
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
    addStatus(uiText().htmlGenerated);
    showSummary(documentWithFigures);
    setPreview(state.portableHtml);
    setDownload(state.portableHtml);
  } catch (error) {
    console.error(error);
    addStatus(error.message || uiText().failed, "error");
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
  document.querySelector("#summary").textContent = uiText().summary(pages, terms, figures);
}

function countEmbeddedFigureBlocks(documentModel) {
  return (documentModel.pages || []).reduce(
    (count, page) => count + (page.blocks || []).filter((block) => block.type === "embedded_figure").length,
    0,
  );
}

function setRunning(isRunning) {
  document.querySelector("#startButton").disabled = isRunning;
  document.querySelector("#startButton").textContent = isRunning ? uiText().running : uiText().start;
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

function applyUiLanguage() {
  const labels = uiText();
  document.documentElement.lang = state.uiLanguage;
  document.querySelector(".topbar p").textContent = labels.tagline;
  document.querySelector(".ui-language span").textContent = labels.uiLanguage;
  document.querySelector(".controls .field:nth-of-type(2) span").textContent = labels.targetLanguage;
  document.querySelector("#targetLanguage").placeholder = labels.targetLanguagePlaceholder;
  document.querySelector(".check span").textContent = labels.saveKey;
  document.querySelector(".note").textContent = labels.privacyNote;
  document.querySelector("#startButton").textContent = state.running ? labels.running : labels.start;
  document.querySelector("#downloadLink").textContent = labels.download;
  document.querySelector(".status-panel h2").textContent = labels.statusTitle;
  document.querySelector(".preview-panel h2").textContent = labels.preview;

  const statusItems = document.querySelectorAll("#statusList li");
  if (statusItems.length === 1 && isInitialStatusText(statusItems[0].textContent)) {
    statusItems[0].textContent = labels.initialStatus;
  }
}

function isInitialStatusText(value) {
  return Object.values(uiTextDictionary()).some((labels) => labels.initialStatus === value);
}

function uiText() {
  const dictionary = uiTextDictionary();

  return dictionary[state.uiLanguage] || dictionary.ja;
}

function uiTextDictionary() {
  return {
    ja: {
      tagline: "Gemini KeyでPDFを学習用の翻訳HTMLに変換します。",
      uiLanguage: "UI",
      targetLanguage: "翻訳先言語",
      targetLanguagePlaceholder: "例: Japanese, Japanese for high school students, 簡体字中国語",
      saveKey: "この端末に保存",
      privacyNote: "Gemini KeyとPDFはこのブラウザからGemini APIへ送信されます。このアプリのサーバーには保存されません。",
      start: "変換を開始",
      running: "処理中...",
      download: "HTMLをダウンロード",
      statusTitle: "処理ステータス",
      initialStatus: "PDFを選択してください。",
      preview: "プレビュー",
      missingInputs: "PDF、Gemini Key、翻訳先言語を入力してください。",
      keyApplied: "Gemini Keyの扱いを反映しました。",
      preparingSnapshots: "PDFページ画像をブラウザ内で準備しています。",
      snapshotsReady: (count) => `${count}ページ分の画像を準備しました。`,
      uploadComplete: "PDFアップロードが完了しました。",
      analysisRunning: "Document Analysis Passを実行しています。",
      analysisReceived: "Document Modelを受信しました。",
      translatingSegment: (current, total) => `Translation Segment ${current}/${total} を翻訳しています。`,
      htmlGenerated: "Portable HTMLを生成しました。",
      failed: "変換に失敗しました。",
      summary: (pages, terms, figures) => `${pages}ページ、Preserved Term ${terms}件、Embedded Figure ${figures}件を含むHTMLを生成しました。`,
    },
    en: {
      tagline: "Convert PDFs into study-ready translated HTML with your Gemini Key.",
      uiLanguage: "UI",
      targetLanguage: "Target language",
      targetLanguagePlaceholder: "e.g. Japanese, Japanese for high school students, Simplified Chinese",
      saveKey: "Save on this device",
      privacyNote: "Your Gemini Key and PDF are sent from this browser to the Gemini API. They are not stored on this app's server.",
      start: "Start conversion",
      running: "Processing...",
      download: "Download HTML",
      statusTitle: "Status",
      initialStatus: "Select a PDF.",
      preview: "Preview",
      missingInputs: "Enter a PDF, Gemini Key, and target language.",
      keyApplied: "Gemini Key preference applied.",
      preparingSnapshots: "Preparing PDF page images in the browser.",
      snapshotsReady: (count) => `Prepared images for ${count} pages.`,
      uploadComplete: "PDF upload complete.",
      analysisRunning: "Running Document Analysis Pass.",
      analysisReceived: "Received Document Model.",
      translatingSegment: (current, total) => `Translating Segment ${current}/${total}.`,
      htmlGenerated: "Generated Portable HTML.",
      failed: "Conversion failed.",
      summary: (pages, terms, figures) => `Generated HTML with ${pages} pages, ${terms} Preserved Terms, and ${figures} Embedded Figures.`,
    },
    ko: {
      tagline: "Gemini Key로 PDF를 학습용 번역 HTML로 변환합니다.",
      uiLanguage: "UI",
      targetLanguage: "번역 대상 언어",
      targetLanguagePlaceholder: "예: Japanese, Japanese for high school students, Simplified Chinese",
      saveKey: "이 기기에 저장",
      privacyNote: "Gemini Key와 PDF는 이 브라우저에서 Gemini API로 전송됩니다. 이 앱의 서버에는 저장되지 않습니다.",
      start: "변환 시작",
      running: "처리 중...",
      download: "HTML 다운로드",
      statusTitle: "처리 상태",
      initialStatus: "PDF를 선택하세요.",
      preview: "미리보기",
      missingInputs: "PDF, Gemini Key, 번역 대상 언어를 입력하세요.",
      keyApplied: "Gemini Key 설정을 반영했습니다.",
      preparingSnapshots: "브라우저에서 PDF 페이지 이미지를 준비하고 있습니다.",
      snapshotsReady: (count) => `${count}페이지의 이미지를 준비했습니다.`,
      uploadComplete: "PDF 업로드가 완료되었습니다.",
      analysisRunning: "Document Analysis Pass를 실행하고 있습니다.",
      analysisReceived: "Document Model을 받았습니다.",
      translatingSegment: (current, total) => `Translation Segment ${current}/${total} 번역 중입니다.`,
      htmlGenerated: "Portable HTML을 생성했습니다.",
      failed: "변환에 실패했습니다.",
      summary: (pages, terms, figures) => `${pages}페이지, Preserved Term ${terms}개, Embedded Figure ${figures}개를 포함한 HTML을 생성했습니다.`,
    },
    "zh-Hans": {
      tagline: "使用 Gemini Key 将 PDF 转换为学习用翻译 HTML。",
      uiLanguage: "UI",
      targetLanguage: "目标语言",
      targetLanguagePlaceholder: "例如：Japanese, Japanese for high school students, 简体中文",
      saveKey: "保存在此设备上",
      privacyNote: "Gemini Key 和 PDF 会从此浏览器发送到 Gemini API。本应用的服务器不会保存它们。",
      start: "开始转换",
      running: "处理中...",
      download: "下载 HTML",
      statusTitle: "处理状态",
      initialStatus: "请选择 PDF。",
      preview: "预览",
      missingInputs: "请输入 PDF、Gemini Key 和目标语言。",
      keyApplied: "已应用 Gemini Key 设置。",
      preparingSnapshots: "正在浏览器中准备 PDF 页面图像。",
      snapshotsReady: (count) => `已准备 ${count} 页图像。`,
      uploadComplete: "PDF 上传完成。",
      analysisRunning: "正在执行 Document Analysis Pass。",
      analysisReceived: "已接收 Document Model。",
      translatingSegment: (current, total) => `正在翻译 Translation Segment ${current}/${total}。`,
      htmlGenerated: "已生成 Portable HTML。",
      failed: "转换失败。",
      summary: (pages, terms, figures) => `已生成包含 ${pages} 页、${terms} 个 Preserved Term、${figures} 个 Embedded Figure 的 HTML。`,
    },
    "zh-Hant": {
      tagline: "使用 Gemini Key 將 PDF 轉換為學習用翻譯 HTML。",
      uiLanguage: "UI",
      targetLanguage: "目標語言",
      targetLanguagePlaceholder: "例如：Japanese, Japanese for high school students, 繁體中文",
      saveKey: "儲存在此裝置上",
      privacyNote: "Gemini Key 和 PDF 會從此瀏覽器傳送到 Gemini API。本應用程式的伺服器不會儲存它們。",
      start: "開始轉換",
      running: "處理中...",
      download: "下載 HTML",
      statusTitle: "處理狀態",
      initialStatus: "請選擇 PDF。",
      preview: "預覽",
      missingInputs: "請輸入 PDF、Gemini Key 和目標語言。",
      keyApplied: "已套用 Gemini Key 設定。",
      preparingSnapshots: "正在瀏覽器中準備 PDF 頁面影像。",
      snapshotsReady: (count) => `已準備 ${count} 頁影像。`,
      uploadComplete: "PDF 上傳完成。",
      analysisRunning: "正在執行 Document Analysis Pass。",
      analysisReceived: "已接收 Document Model。",
      translatingSegment: (current, total) => `正在翻譯 Translation Segment ${current}/${total}。`,
      htmlGenerated: "已產生 Portable HTML。",
      failed: "轉換失敗。",
      summary: (pages, terms, figures) => `已產生包含 ${pages} 頁、${terms} 個 Preserved Term、${figures} 個 Embedded Figure 的 HTML。`,
    },
  };
}
