/** Self-contained review copy; authoritative editable sources remain Markdown. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const targets = new Map([
  ["launch-readiness/RISK-REGISTER.md", "#risk-register"],
  ["launch-readiness/EVIDENCE.md", "#evidence"],
  ["../COLUMBUS-LAUNCH-READINESS.md", "#assessment"],
  ["EVIDENCE.md", "#evidence"],
]);
function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, label, href) =>
      targets.has(href) ? `<a href="${targets.get(href)}">${label}</a>` : `${label} (${href})`);
}
function render(markdown) {
  const lines = markdown.split("\n");
  let result = "", code = false, table = false, list = false, paragraph = [];
  const flush = () => {
    if (paragraph.length) result += `<p>${inline(paragraph.join(" "))}</p>`;
    paragraph = [];
  };
  const close = () => {
    flush();
    if (table) { result += "</tbody></table></div>"; table = false; }
    if (list) { result += "</ul>"; list = false; }
  };
  for (const line of lines) {
    if (line.startsWith("```")) { close(); result += code ? "</code></pre>" : "<pre><code>"; code = !code; continue; }
    if (code) { result += escape(line) + "\n"; continue; }
    const heading = /^(#{1,6}) (.*)/.exec(line);
    if (heading) { close(); result += `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`; continue; }
    if (line.startsWith("|")) {
      flush();
      if (/^\|[\s|:-]+\|$/.test(line)) continue;
      const cells = line.slice(1, -1).split("|").map(x => inline(x.trim()));
      if (!table) {
        if (list) { result += "</ul>"; list = false; }
        result += `<div class="table"><table><thead><tr>${cells.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>`;
        table = true;
      } else result += `<tr>${cells.map(x => `<td>${x}</td>`).join("")}</tr>`;
      continue;
    }
    if (table) { result += "</tbody></table></div>"; table = false; }
    if (/^[-*] /.test(line)) {
      flush();
      if (!list) { result += "<ul>"; list = true; }
      result += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    if (!line.trim()) { close(); continue; }
    if (list && line.startsWith("  ")) result += `<p class="continuation">${inline(line.trim())}</p>`;
    else { if (list) { result += "</ul>"; list = false; } paragraph.push(line.trim()); }
  }
  close();
  return result;
}
let body = "";
for (const [id, path] of [
  ["assessment", "docs/COLUMBUS-LAUNCH-READINESS.md"],
  ["risk-register", "docs/launch-readiness/RISK-REGISTER.md"],
  ["evidence", "docs/launch-readiness/EVIDENCE.md"],
]) body += `<section id="${id}">${render(await readFile(path, "utf8"))}</section>`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Columbus FTO Portal — Launch Readiness Assessment</title>
<style>
body{font:16px/1.6 system-ui,sans-serif;color:#162936;background:#f4f6f8;margin:0}
nav{padding:18px max(24px,calc((100vw - 1120px)/2));background:#123c55;color:white}
nav a{color:white;margin-right:24px}main{max-width:1120px;margin:auto;padding:32px;background:white}
h1{font-size:30px;line-height:1.2;color:#123c55}h2{border-top:2px solid #c6d3dc;padding-top:24px;margin-top:36px}
h3{color:#194d6c}section+section{margin-top:64px}a{color:#005d8f}
code{font:13px/1.5 ui-monospace,monospace;background:#edf2f5;overflow-wrap:anywhere}
pre{padding:16px;background:#edf2f5;overflow:auto}pre code{white-space:pre-wrap}
.table{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:18px 0}
th,td{border:1px solid #c6d3dc;padding:10px;text-align:left;vertical-align:top}
th{background:#edf2f5}li{margin:9px 0}.continuation{margin-top:-5px}strong{color:#143449}
@media print{body,main{background:white;padding:0}nav{display:none}h2,h3{break-after:avoid}tr{break-inside:avoid}}
</style><nav><a href="#assessment">Assessment & gates</a><a href="#risk-register">21 findings</a>
<a href="#evidence">Evidence & limits</a></nav><main>${body}</main></html>`;
await mkdir("generated-artifacts/launch-readiness", { recursive: true });
await writeFile("generated-artifacts/launch-readiness/columbus-handoff.html", html);
console.log("Created self-contained Columbus handoff review copy.");
