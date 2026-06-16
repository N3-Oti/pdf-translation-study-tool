export function assemblePortableHtml(documentModel) {
  const title = documentModel.title || "Translated PDF";
  const lang = documentModel.targetLanguage || "ja";
  const body = documentModel.pages.map(renderPage).join("\n");
  const glossary = renderGlossary(documentModel.preservedTerms || []);
  const pageNav = renderPageNav(documentModel.pages || []);
  const stats = renderStats(documentModel);

  return `<!doctype html>
<html lang="${escapeAttribute(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${portableCss()}</style>
</head>
<body>
  <article class="document">
    <header class="document__header">
      <p class="document__eyebrow">Translated study HTML</p>
      <h1>${escapeHtml(title)}</h1>
      ${stats}
      ${pageNav}
    </header>
    ${body}
    ${glossary}
  </article>
</body>
</html>`;
}

function renderStats(documentModel) {
  const pageCount = documentModel.pages?.length || 0;
  const termCount = documentModel.preservedTerms?.length || 0;
  const figureCount = documentModel.embeddedFigureCount || countBlocks(documentModel, "embedded_figure");

  return `<dl class="document__stats">
    <div><dt>Pages</dt><dd>${escapeHtml(String(pageCount))}</dd></div>
    <div><dt>Terms</dt><dd>${escapeHtml(String(termCount))}</dd></div>
    <div><dt>Figures</dt><dd>${escapeHtml(String(figureCount))}</dd></div>
  </dl>`;
}

function renderPageNav(pages) {
  if (pages.length < 2) {
    return "";
  }

  return `<nav class="page-nav" aria-label="Pages">
    ${pages.map((page) => `<a href="#page-${escapeAttribute(page.pageNumber)}">${escapeHtml(String(page.pageNumber))}</a>`).join("")}
  </nav>`;
}

function renderPage(page) {
  const blocks = (page.blocks || []).map(renderBlock).join("\n");
  return `<section class="page" id="page-${escapeAttribute(page.pageNumber)}">
  <header class="page__header">
    <span class="page__number">Page ${escapeHtml(String(page.pageNumber))}</span>
    <a class="page__top" href="#">Top</a>
  </header>
  <div class="page__body">
    ${blocks}
  </div>
</section>`;
}

function renderBlock(block) {
  if (block.type === "heading") {
    const level = Math.min(Math.max(Number(block.level || 2), 1), 3);
    return `<h${level} id="${escapeAttribute(block.id)}">${escapeHtml(block.text || "")}</h${level}>`;
  }

  if (block.type === "learning_table") {
    return renderTable(block);
  }

  if (block.type === "bullet_list" || block.type === "ordered_list") {
    return renderList(block);
  }

  if (block.type === "embedded_figure") {
    return renderFigure(block);
  }

  return `<p id="${escapeAttribute(block.id)}">${escapeHtml(block.text || "")}</p>`;
}

function renderList(block) {
  const tag = block.type === "ordered_list" ? "ol" : "ul";
  const items = block.items || [];
  return `<${tag} id="${escapeAttribute(block.id)}" class="text-list">
    ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")}
  </${tag}>`;
}

function renderTable(block) {
  const headers = block.headers || [];
  const rows = block.rows || [];
  const caption = block.caption ? `<caption>${escapeHtml(block.caption)}</caption>` : "";
  const head = headers.length
    ? `<thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>`
    : "";
  const body = `<tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<div class="table-wrap"><table id="${escapeAttribute(block.id)}">${caption}${head}${body}</table></div>`;
}

function renderFigure(block) {
  if (!block.dataUrl) {
    return "";
  }

  const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
  return `<figure class="figure" id="${escapeAttribute(block.id)}">
    <img src="${escapeAttribute(block.dataUrl)}" alt="${escapeAttribute(block.alt || block.caption || "Embedded figure")}">
    ${caption}
  </figure>`;
}

function renderGlossary(terms) {
  if (!terms.length) {
    return "";
  }

  const items = terms
    .map((entry) => {
      const appearances = (entry.appearances || [])
        .map((appearance) => `<a href="#${escapeAttribute(appearance.blockId)}">P.${escapeHtml(String(appearance.pageNumber))}</a>`)
        .join(", ");
      return `<li class="glossary__item">
        <h3>${escapeHtml(entry.term)}</h3>
        <p>${escapeHtml(entry.explanation || "")}</p>
        <p class="glossary__links">${appearances}</p>
      </li>`;
    })
    .join("");

  return `<section class="glossary" id="glossary">
    <header class="section-heading">
      <p>Reference</p>
      <h2>Glossary &amp; Index</h2>
    </header>
    <ol>${items}</ol>
  </section>`;
}

function portableCss() {
  return `
html { scroll-behavior: smooth; }
body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #20242c; background: #eef2f6; }
.document { max-width: 1040px; margin: 0 auto; padding: 34px 18px 64px; }
.document__header, .page, .glossary { background: #fff; border: 1px solid #d7dee8; border-radius: 8px; box-shadow: 0 14px 36px rgba(43, 55, 72, 0.08); }
.document__header { padding: 28px; margin-bottom: 22px; }
.document__eyebrow, .section-heading p { margin: 0 0 8px; color: #53606f; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.document__header h1 { margin: 0; max-width: 780px; font-size: 32px; line-height: 1.2; }
.document__stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 22px 0 0; }
.document__stats div { min-width: 92px; border: 1px solid #dce3ec; border-radius: 8px; padding: 9px 12px; background: #f8fafc; }
.document__stats dt { margin: 0 0 4px; color: #5d6878; font-size: 12px; font-weight: 700; }
.document__stats dd { margin: 0; font-size: 20px; font-weight: 800; }
.page-nav { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 20px; }
.page-nav a { min-width: 34px; border: 1px solid #cfd8e5; border-radius: 6px; padding: 5px 8px; color: #174d76; background: #f4f8fc; font-size: 13px; font-weight: 700; text-align: center; text-decoration: none; }
.page, .glossary { margin-bottom: 20px; overflow: hidden; }
.page__header { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 1px solid #e3e8ef; padding: 12px 22px; background: #f8fafc; }
.page__number { color: #445164; font-size: 13px; font-weight: 800; }
.page__top { color: #2d6187; font-size: 13px; font-weight: 700; text-decoration: none; }
.page__body { padding: 24px 26px 28px; }
h1, h2, h3 { line-height: 1.28; margin: 1.55em 0 0.6em; color: #171b22; }
.page__body > h1:first-child, .page__body > h2:first-child, .page__body > h3:first-child { margin-top: 0; }
.page__body h1 { border-bottom: 2px solid #d9e2ec; padding-bottom: 8px; font-size: 26px; }
.page__body h2 { font-size: 22px; }
.page__body h3 { font-size: 18px; }
p { line-height: 1.9; margin: 0 0 1.25em; white-space: pre-line; overflow-wrap: anywhere; }
.text-list { margin: 0 0 1.3em 1.45em; padding: 0; line-height: 1.8; }
.text-list li { margin-bottom: 0.5em; padding-left: 0.15em; white-space: pre-line; overflow-wrap: anywhere; }
.table-wrap { margin: 18px 0 22px; overflow-x: auto; border: 1px solid #cfd8e5; border-radius: 8px; }
table { width: 100%; border-collapse: collapse; table-layout: auto; background: #fff; }
caption { text-align: left; font-weight: 800; padding: 12px 14px; background: #f8fafc; border-bottom: 1px solid #dbe3ee; }
th, td { border: 1px solid #dbe3ee; padding: 11px 12px; vertical-align: top; line-height: 1.65; white-space: pre-line; overflow-wrap: anywhere; }
th { background: #eef4f9; text-align: left; font-weight: 800; }
.figure { margin: 20px 0; border: 1px solid #dbe3ee; border-radius: 8px; padding: 12px; background: #fbfcfe; }
img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
figcaption { color: #5d6470; font-size: 14px; line-height: 1.6; margin-top: 10px; }
.glossary { padding: 24px 26px; }
.section-heading h2 { margin: 0 0 16px; font-size: 24px; }
.glossary ol { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; padding: 0; margin: 0; list-style: none; }
.glossary__item { border: 1px solid #dbe3ee; border-radius: 8px; padding: 14px; background: #fbfcfe; }
.glossary__item h3 { margin: 0 0 8px; font-size: 16px; }
.glossary__item p { margin-bottom: 8px; line-height: 1.65; }
.glossary__links { font-size: 14px; }
.glossary__links a { color: #1f5f8b; font-weight: 700; }
@media (max-width: 680px) {
  .document { padding: 16px 10px 40px; }
  .document__header { padding: 20px; }
  .document__header h1 { font-size: 25px; }
  .page__body, .glossary { padding: 18px 16px; }
  .page__header { padding: 11px 16px; }
}`;
}

function countBlocks(documentModel, type) {
  return (documentModel.pages || []).reduce(
    (count, page) => count + (page.blocks || []).filter((block) => block.type === type).length,
    0,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
