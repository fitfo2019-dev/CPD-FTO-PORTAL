import assert from "node:assert/strict";
import test from "node:test";
import {
  createHtmlDocument,
  markdownToHtml,
  markdownToPlainText,
} from "./export-executive-brief.mjs";

test("renders headings, inline formatting, lists, quotes, and tables as HTML", () => {
  const source = [
    "# Executive Brief",
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
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<blockquote><p>A quoted notice\.<\/p><\/blockquote>/);
  assert.match(html, /<ol>[\s\S]*<li>First step<\/li>[\s\S]*<li>Second step<\/li>/);
  assert.match(html, /<th>Label<\/th>/);
  assert.match(html, /<td><strong>Yes<\/strong><\/td>/);
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

test("escapes source HTML instead of treating it as markup", () => {
  const html = markdownToHtml("<script>alert('no')</script>");

  assert.match(html, /&lt;script&gt;alert\(&#39;no&#39;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
