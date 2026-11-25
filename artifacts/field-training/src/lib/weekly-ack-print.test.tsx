import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WeeklyPacketAcknowledgement } from './model.js';
import { phaseLabel } from './model.js';

// Exercise the real component and SVG branding with the app's JSX/asset
// transforms, in an isolated cache that cannot disrupt the preview server.
let server:Awaited<ReturnType<typeof createServer>>;
let PrintableWeeklyAcknowledgement:typeof import('../components/printable-weekly-ack.js').PrintableWeeklyAcknowledgement;
before(async()=>{
  const root=path.resolve(import.meta.dirname,'../..');
  server=await createServer({
    root,configFile:false,cacheDir:path.resolve(root,'../../generated-artifacts/ack-unit-cache'),
    resolve:{alias:{'@':path.join(root,'src')},dedupe:['react','react-dom']},
    optimizeDeps:{noDiscovery:true,include:[]},
    esbuild:{jsx:'automatic'},server:{middlewareMode:true},appType:'custom',
  });
  ({PrintableWeeklyAcknowledgement}=await server.ssrLoadModule('/src/components/printable-weekly-ack.tsx'));
});
after(async()=>{await server?.close();});

function sample():WeeklyPacketAcknowledgement {
  return {
    id:'fictional-ack-test',weekStart:'2026-11-22',weekEnd:'2026-11-28',weekNumber:4,phase:2,
    recruitName:'Fictional PO',recruitBadge:'PO-101',recruitAssignment:'PO Assignment A',
    ftoName:'Fictional FTO',ftoBadge:'FTO-202',ftoAssignment:'FTO Assignment B',
    recruitComments:'PO saved comment',ftoComments:'FTO saved comment',officeComments:'Office saved comment',
    signatures:{},status:'draft',createdAt:'2026-11-24T12:00:00Z',updatedAt:'2026-11-24T12:00:00Z',
  };
}

test('acknowledgement metadata labels map to their own saved fields and preserve role order',async()=>{
  const record=sample(),before=structuredClone(record);
  const html=renderToStaticMarkup(<PrintableWeeklyAcknowledgement acknowledgement={record}/>);
  const fields=[
    ['Probationary Officer',record.recruitName],['PO Badge',record.recruitBadge],
    ['PO Assignment',record.recruitAssignment],['Field Training Officer',record.ftoName],
    ['FTO Badge',record.ftoBadge],['FTO Assignment',record.ftoAssignment],
    ['Training Phase',phaseLabel(record.phase)],['Training Week','4'],
  ];
  for(const [label,value] of fields)assert.ok(html.includes(`<b>${label}</b>${value}</span>`),label);
  assert.equal((html.match(/class="print-ack-role"/g)||[]).length,3);
  const labels=['Probationary Officer Comments','Probationary Officer signature','FTO Comments','FTO signature','Field Training Office Comments','Field Training Office signature'];
  assert.deepEqual(labels.map(label=>html.indexOf(label)),labels.map(label=>html.indexOf(label)).sort((a,b)=>a-b));
  for(const value of [record.recruitComments,record.ftoComments,record.officeComments,'certificate-based Digital ID'])assert.ok(html.includes(value));
  assert.deepEqual(record,before);
});

test('missing optional acknowledgement values stay blank without invented personnel or signatures',async()=>{
  const record=sample();
  Object.assign(record,{recruitName:'',recruitBadge:'',recruitAssignment:'',ftoName:'',ftoBadge:'',ftoAssignment:'',recruitComments:'',ftoComments:'',officeComments:''});
  const html=renderToStaticMarkup(<PrintableWeeklyAcknowledgement acknowledgement={record}/>);
  assert.equal((html.match(/class="print-ack-role"/g)||[]).length,3);
  assert.equal((html.match(/class="print-signature-mark"><\/div>/g)||[]).length,3);
  assert.ok(!html.includes('Sample')&&!html.includes('Not recorded')&&!html.includes('undefined'));
});
