import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = path.join(projectRoot, "docs/COLUMBUS_FTO_PORTAL_BRIEFING.md");
const outputDirectory = path.join(projectRoot, "generated-artifacts/website-records");
const outputStem = "City-of-Columbus-Chain-of-Command-Brief";
const previousOutputStem = "City-of-Columbus-Executive-Brief";

// This is the existing Columbus website-records print stylesheet.
const printStyles = `
@page { size: Letter; margin: .65in .55in .7in; }
* { box-sizing: border-box; }
body { font: 10pt/1.45 Arial, sans-serif; color: #172d46; margin: 0; }
h1 { font-size: 24pt; line-height: 1.1; border-bottom: 3px solid #17304b; padding-bottom: 12px; }
h2 { font-size: 15pt; margin: 22px 0 8px; }
h3 { font-size: 12pt; margin: 16px 0 6px; }
h1, h2, h3, h4 { break-after: avoid; }
p, li { overflow-wrap: anywhere; }
blockquote { margin: 12px 0; padding: 8px 12px; border-left: 3px solid #a9771b; background: #fbf5e8; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 8pt; table-layout: auto; }
thead { display: table-header-group; }
th { background: #edf1f5; text-align: left; }
td, th { border: 1px solid #bcc6d0; padding: 6px; vertical-align: top; overflow-wrap: anywhere; }
tr { break-inside: avoid; }
code { font-size: 8.3pt; background: #edf1f5; overflow-wrap: anywhere; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid #ccd4dd; background: #f4f6f8; padding: 10px; font-size: 8pt; }
a { color: #07578c; text-decoration: underline; }
img { max-width: 100%; }
`.trim();

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(markdown) {
  const tokens = [];
  const stash = (html) => {
    const token = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return token;
  };

  let text = markdown.replace(/`([^`]+)`/g, (_match, code) => stash(`<code>${escapeHtml(code)}</code>`));
  text = escapeHtml(text);
  text = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');

  return text.replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)]);
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isBlockStart(lines, index) {
  const line = lines[index] ?? "";
  return (
    /^#{1,6}\s/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*(?:[-*+]\s|\d+\.\s)/.test(line) ||
    /^\s*\|/.test(line) ||
    /^\s*(```|~~~)/.test(line)
  );
}

export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith(">")) {
      const quote = [];
      while (index < lines.length && lines[index].trimStart().startsWith(">")) {
        quote.push(lines[index].trimStart().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(`<blockquote><p>${renderInline(quote.join("\n"))}</p></blockquote>`);
      continue;
    }

    if (/^\s*\|/.test(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\s*\|/.test(lines[index])) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      const headerHtml = headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("\n");
      const bodyHtml = rows
        .map((row) => `<tr>${headers.map((_header, cellIndex) => `<td>${renderInline(row[cellIndex] ?? "")}</td>`).join("")}</tr>`)
        .join("\n");
      blocks.push(`<table>\n<thead><tr>${headerHtml}</tr></thead>\n<tbody>${bodyHtml}</tbody>\n</table>`);
      continue;
    }

    const listMatch = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = listMatch[2] !== undefined;
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
        if (!item || (item[2] !== undefined) !== ordered) break;
        items.push(`<li>${renderInline(item[3])}</li>`);
        index += 1;
      }
      blocks.push(`<${tag}>\n${items.join("\n")}\n</${tag}>`);
      continue;
    }

    if (/^\s*(```|~~~)/.test(line)) {
      const fence = line.trim().slice(0, 3);
      index += 1;
      const code = [];
      while (index < lines.length && !lines[index].trimStart().startsWith(fence)) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join("\n"))}</p>`);
  }

  return blocks.join("\n");
}

function inlineToPlainText(markdown) {
  return markdown
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)");
}

export function markdownToPlainText(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      if (output.at(-1) !== "") output.push("");
      index += 1;
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      output.push(inlineToPlainText(heading[1]), "");
      index += 1;
      continue;
    }

    if (/^\s*\|/.test(line)) {
      while (index < lines.length && /^\s*\|/.test(lines[index])) {
        if (!isTableSeparator(lines[index])) {
          output.push(tableCells(lines[index]).map(inlineToPlainText).join(" | "));
        }
        index += 1;
      }
      output.push("");
      continue;
    }

    const quote = line.trimStart().match(/^>\s?(.*)$/);
    if (quote) {
      output.push(inlineToPlainText(quote[1]));
      index += 1;
      continue;
    }

    const listItem = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listItem) {
      output.push(`${"  ".repeat(Math.floor(listItem[1].length / 2))}${listItem[2]} ${inlineToPlainText(listItem[3])}`);
      index += 1;
      continue;
    }

    output.push(inlineToPlainText(line));
    index += 1;
  }

  return `${output.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function createHtmlDocument(markdown) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (!titleMatch) throw new Error("The canonical brief must begin with a level-one title.");
  const title = escapeHtml(titleMatch[1].trim());
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${printStyles}
</style>
</head>
<body>
${markdownToHtml(markdown)}
</body>
</html>
`;
}

async function main() {
  const markdown = await readFile(sourcePath, "utf8");
  const markdownOutput = path.join(outputDirectory, `${outputStem}.md`);
  const textOutput = path.join(outputDirectory, `${outputStem}.txt`);
  const htmlOutput = path.join(outputDirectory, `${outputStem}.html`);
  const pdfOutput = path.join(outputDirectory, `${outputStem}.pdf`);
  const temporaryPdfOutput = `${pdfOutput}.tmp`;

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(markdownOutput, markdown, "utf8"),
    writeFile(textOutput, markdownToPlainText(markdown), "utf8"),
    writeFile(htmlOutput, createHtmlDocument(markdown), "utf8"),
  ]);

  try {
    const browser = process.env.CHROME_BIN || "chromium";
    execFileSync(
      browser,
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--no-pdf-header-footer",
        `--print-to-pdf=${temporaryPdfOutput}`,
        `file://${htmlOutput}`,
      ],
      { cwd: projectRoot, stdio: "inherit" },
    );
    await rename(temporaryPdfOutput, pdfOutput);
  } catch (error) {
    await rm(temporaryPdfOutput, { force: true });
    throw new Error(`PDF generation failed. Ensure Chromium is installed or set CHROME_BIN. ${error.message}`, { cause: error });
  }

  await Promise.all(
    ["md", "txt", "html", "pdf"].map((extension) =>
      rm(path.join(outputDirectory, `${previousOutputStem}.${extension}`), { force: true }),
    ),
  );
  console.log(`Refreshed Markdown, text, HTML, and PDF exports in ${path.relative(projectRoot, outputDirectory)}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
