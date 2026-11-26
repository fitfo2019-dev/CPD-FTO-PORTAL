import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createHtmlDocument,
  markdownToHtml,
  markdownToPlainText,
} from "./export-executive-brief.mjs";

test("renders headings, inline formatting, lists, quotes, and tables as HTML", () => {
  const source = [
    "# Executive Brief",
    "## City decisions & acceptance",
    "",
    "[City decisions](#city-decisions-acceptance)",
    "",
    "A **bold** point with `code`.",
    "",
    "> A quoted notice.",
    "",
    "1. First step",
    "2. Second step",
    "",
    "| Label | Meaning |",
    "| --- | --- |",
    "| Ready | **Yes** |",
  ].join("\n");
  const html = markdownToHtml(source);

  assert.match(html, /<h1>Executive Brief<\/h1>/);
  assert.match(html, /<h2 id="city-decisions-acceptance">City decisions &amp; acceptance<\/h2>/);
  assert.match(html, /<a href="#city-decisions-acceptance">City decisions<\/a>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<blockquote><p>A quoted notice\.<\/p><\/blockquote>/);
  assert.match(html, /<ol>[\s\S]*<li>First step<\/li>[\s\S]*<li>Second step<\/li>/);
  assert.match(html, /<th>Label<\/th>/);
  assert.match(html, /<td><strong>Yes<\/strong><\/td>/);
});

test("gives duplicate headings unique in-page destinations", () => {
  const html = markdownToHtml("## Readiness\n\n## Readiness");

  assert.match(html, /<h2 id="readiness">Readiness<\/h2>/);
  assert.match(html, /<h2 id="readiness-2">Readiness<\/h2>/);
});

test("plain text keeps content while removing Markdown syntax", () => {
  const plain = markdownToPlainText([
    "# Executive Brief",
    "",
    "A **bold** point with `code`.",
    "",
    "| Label | Meaning |",
    "| --- | --- |",
    "| Ready | **Yes** |",
  ].join("\n"));

  assert.equal(plain, "Executive Brief\n\nA bold point with code.\n\nLabel | Meaning\nReady | Yes\n");
});

test("HTML document uses the brief title and existing print layout", () => {
  const html = createHtmlDocument("# City of Columbus Chain of Command Brief\n\nText.");

  assert.match(html, /<title>City of Columbus Chain of Command Brief<\/title>/);
  assert.match(html, /@page \{ size: Letter; margin: \.65in \.55in \.7in; \}/);
  assert.match(html, /<h1>City of Columbus Chain of Command Brief<\/h1>/);
});

test("executive brief contents links match every canonical level-two section", async () => {
  const source = await readFile(new URL("../../docs/COLUMBUS_FTO_PORTAL_BRIEFING.md", import.meta.url), "utf8");
  const html = createHtmlDocument(source);
  const canonicalHeadings = [...source.matchAll(/^##\s+(.+?)\s*#*\s*$/gm)]
    .slice(1)
    .filter((match) => match[1].toLowerCase() !== "contents")
    .map((match) => match[1]);
  const contentsLinks = [...html.matchAll(/<li><a href="#([^"]+)">([^<]*)<\/a><\/li>/g)];

  assert.deepEqual(contentsLinks.map(([, , label]) => label), canonicalHeadings);
  for (const [, id] of contentsLinks) {
    assert.match(html, new RegExp(`<h2 id="${id}">`));
  }
  assert.match(html, /<nav class="contents" aria-label="Contents">/);
});

test("contents anchors are unique when section headings repeat", () => {
  const html = createHtmlDocument("# Brief\n\n## Stakeholder briefing\n\n## First section\n\n## First section");

  assert.match(html, /<li><a href="#first-section">First section<\/a><\/li>/);
  assert.match(html, /<li><a href="#first-section-2">First section<\/a><\/li>/);
  assert.match(html, /<h2 id="first-section-2">First section<\/h2>/);
});

test("escapes source HTML instead of treating it as markup", () => {
  const html = markdownToHtml("<script>alert('no')</script>");

  assert.match(html, /&lt;script&gt;alert\(&#39;no&#39;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
