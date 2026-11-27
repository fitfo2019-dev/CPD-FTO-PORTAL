import { getApplicationHelpTopicsForRole, getApplicationHelpWorkflowsForRole } from './application-help.js';
import { ROLE_LABEL, type Role } from './model.js';

const escape = (value: string) => value.replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);

export type RoleManualAssets = { wordmarkSvg: string; patchUrl: string; badgeUrl: string };

/** One branded US Letter portrait manual per role, built from that role's Help Desk content only. */
export function roleManualHtml(role: Role, madeOn: string, assets: RoleManualAssets): string {
  const workflows = getApplicationHelpWorkflowsForRole(role);
  const topics = getApplicationHelpTopicsForRole(role);
  const roleName = ROLE_LABEL[role];
  const ref = (manual?: string) => manual ? `<span class="ref">${escape(manual)}</span>` : '';
  const workflowBlocks = workflows.map(workflow => `<section class="item">
      <h3>${escape(workflow.title)}${ref(workflow.manual)}</h3>
      <ol>${workflow.steps.map(step => `<li>${escape(step.text)}</li>`).join('')}</ol>
    </section>`).join('');
  const topicBlocks = topics.map(topic => `<section class="item">
      <h3>${escape(topic.title)}${ref(topic.manual)}</h3>
      <h4>Steps</h4><ol>${topic.steps.map(step => `<li>${escape(step)}</li>`).join('')}</ol>
      <h4>Expected result</h4><p>${escape(topic.expectedResult)}</p>
      <h4>Recovery</h4><p>${escape(topic.recovery)}</p>
    </section>`).join('');
  const footer = `Portal Manual · ${escape(roleName)} · ${escape(madeOn)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Portal Manual - ${escape(roleName)}</title>
<style>
@page { size: letter portrait; margin: 0.5in;
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Arial, Helvetica, sans-serif; color: #444; } }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #111; font: 10pt/1.35 Arial, Helvetica, sans-serif;
  print-color-adjust: exact; -webkit-print-color-adjust: exact; }
table.frame { width: 100%; border-collapse: collapse; }
table.frame td { padding: 0; vertical-align: top; }
.head { position: relative; height: 0.8in; border-bottom: 2px solid #142d4f; margin-bottom: 10pt; }
.wordmark { position: absolute; left: 0; top: 0.08in; width: 1.55in; line-height: 0; }
.wordmark svg { width: 100%; height: auto; display: block; }
.titles { position: absolute; left: 50%; top: 0.14in; transform: translateX(-50%); text-align: center; color: #142d4f; }
.titles b { display: block; font-size: 13pt; letter-spacing: .06em; }
.titles span { display: block; font-size: 9pt; font-weight: 700; letter-spacing: .08em; color: #334155; margin-top: 2pt; }
.patch { position: absolute; right: 0; top: 0; height: 0.7in; }
.foot { position: relative; height: 0.42in; margin-top: 8pt; border-top: 1px solid #94a3b8; }
.badge { position: absolute; left: 0; bottom: 0; height: 0.36in; }
.foot-text { position: absolute; left: 0.45in; bottom: 0.08in; font-size: 8pt; color: #444; }
h1 { margin: 0 0 2pt; color: #142d4f; font-size: 20pt; }
.meta { margin: 0 0 12pt; color: #334155; font-size: 10pt; }
h2 { margin: 14pt 0 6pt; padding: 3pt 6pt; background: #142d4f; color: #fff; font-size: 11pt; letter-spacing: .06em; text-transform: uppercase; break-after: avoid; }
.item { break-inside: avoid; border: 1px solid #94a3b8; padding: 6pt 8pt; margin-bottom: 6pt; }
h3 { margin: 0 0 4pt; color: #142d4f; font-size: 11pt; display: flex; justify-content: space-between; gap: 8pt; }
.ref { flex: none; font-size: 7.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #334155; border: 1px solid #94a3b8; padding: 1pt 4pt; align-self: flex-start; }
h4 { margin: 4pt 0 1pt; font-size: 8pt; letter-spacing: .06em; text-transform: uppercase; color: #334155; }
ol { margin: 0; padding-left: 16pt; } li { margin: 1pt 0; } p { margin: 0; }
</style></head><body>
<table class="frame">
<thead><tr><td><div class="head">
  <span class="wordmark" role="img" aria-label="City of Columbus">${assets.wordmarkSvg}</span>
  <span class="titles"><b>DIVISION OF POLICE</b><span>FIELD TRAINING OFFICE</span></span>
  <img class="patch" src="${escape(assets.patchUrl)}" alt="">
</div></td></tr></thead>
<tfoot><tr><td><div class="foot"><img class="badge" src="${escape(assets.badgeUrl)}" alt=""><span class="foot-text">${footer}</span></div></td></tr></tfoot>
<tbody><tr><td>
  <h1>Field Training Officer Portal Manual</h1>
  <p class="meta">${escape(roleName)} · ${escape(madeOn)}</p>
  ${workflows.length ? `<h2>Workflows</h2>${workflowBlocks}` : ''}
  <h2>How-to's</h2>${topicBlocks}
</td></tr></tbody>
</table>
</body></html>`;
}
