export function assemblePortableHtml(documentModel) {
  const title = documentModel.title || "Translated PDF";
  const lang = documentModel.targetLanguage || "ja";
  const body = documentModel.pages.map(renderPage).join("\n");
  const glossary = renderGlossary(documentModel.preservedTerms || []);

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
      <h1>${escapeHtml(title)}</h1>
      <p>Translated study HTML</p>
    </header>
    ${body}
    ${glossary}
  </article>
</body>
</html>`;
}

function renderPage(page) {
  const blocks = (page.blocks || []).map(renderBlock).join("\n");
  return `<section class="page" id="page-${escapeAttribute(page.pageNumber)}">
  <div class="page__number">Page ${escapeHtml(String(page.pageNumber))}</div>
  ${blocks}
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
  return `<table id="${escapeAttribute(block.id)}">${caption}${head}${body}</table>`;
}

function renderFigure(block) {
  if (!block.dataUrl) {
    return "";
  }

  const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
  return `<figure id="${escapeAttribute(block.id)}">
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
      return `<li>
        <h3>${escapeHtml(entry.term)}</h3>
        <p>${escapeHtml(entry.explanation || "")}</p>
        <p class="glossary__links">${appearances}</p>
      </li>`;
    })
    .join("");

  return `<section class="glossary" id="glossary">
    <h2>Glossary &amp; Index</h2>
    <ol>${items}</ol>
  </section>`;
}

function portableCss() {
  return `
body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #171717; background: #f6f7f9; }
.document { max-width: 980px; margin: 0 auto; padding: 32px 18px 56px; }
.document__header, .page, .glossary { background: #fff; border: 1px solid #d9dde4; border-radius: 8px; padding: 22px; margin-bottom: 18px; }
.document__header h1 { margin: 0 0 8px; font-size: 28px; }
.document__header p, .page__number { color: #5d6470; }
.page__number { font-size: 13px; margin-bottom: 18px; }
h1, h2, h3 { line-height: 1.25; margin: 1.4em 0 0.55em; }
.page > h1:first-of-type, .page > h2:first-of-type, .page > h3:first-of-type { margin-top: 0; }
p { line-height: 1.85; margin: 0 0 1.15em; white-space: pre-line; overflow-wrap: anywhere; }
.text-list { margin: 0 0 1.2em 1.4em; padding: 0; line-height: 1.75; }
.text-list li { margin-bottom: 0.45em; white-space: pre-line; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; table-layout: auto; }
caption { text-align: left; font-weight: 700; margin-bottom: 8px; }
th, td { border: 1px solid #cfd5df; padding: 10px; vertical-align: top; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
th { background: #eef2f7; text-align: left; }
figure { margin: 16px 0; }
img { max-width: 100%; height: auto; display: block; }
figcaption { color: #5d6470; font-size: 14px; margin-top: 8px; }
.glossary ol { padding-left: 24px; }
.glossary li { margin-bottom: 16px; }
.glossary__links { font-size: 14px; }
@media (max-width: 680px) {
  .document { padding: 16px 10px 36px; }
  .document__header, .page, .glossary { padding: 14px; }
  table { display: block; overflow-x: auto; }
}`;
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
