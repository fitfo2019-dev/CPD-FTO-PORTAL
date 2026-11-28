import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {PacketPoTotals,PacketSubmissionDetail,PacketSubmissionState,PacketHandoffStatus} from '@workspace/api-client-react';
import {HandoffTag,PacketDocument,StatusTag} from '../components/packet-review/packet-view.js';
import {PoPacketSummary} from '../components/packet-review/po-summary.js';

Object.assign(globalThis,{React});

test('receipt never renders as COMPLETE; only approved packets use that label',()=>{
  for(const [state,label] of Object.entries({
    submitted:'SUBMITTED',acknowledged:'PACKET ACKNOWLEDGE',approved:'COMPLETE',correction_requested:'RETURNED',
  })){
    const html=renderToStaticMarkup(createElement(StatusTag,{state:state as PacketSubmissionState}));
    assert.ok(html.includes(label));
    if(state!=='approved') assert.ok(!html.includes('COMPLETE'));
  }
});
test('handoff labels distinguish PO review, Coordinator receipt, approval, release, and PO acknowledgment',()=>{
  const labels:Record<PacketHandoffStatus,string>={
    draft:'DRAFT · NOT SUBMITTED',
    awaiting_po_totals_review:'AWAITING PO REVIEW',
    awaiting_coordinator_receipt:'AWAITING COORDINATOR RECEIPT',
    coordinator_review:'COORDINATOR REVIEW',
    correction_requested:'RETURNED',
    awaiting_po_release:'APPROVED · NOT RELEASED',
    awaiting_po_acknowledgment:'RELEASED · PO RECEIPT PENDING',
    po_acknowledged:'PO RECEIPT ACKNOWLEDGED',
    withdrawn:'WITHDRAWN',
  };
  for(const [status,label] of Object.entries(labels)){
    const html=renderToStaticMarkup(createElement(HandoffTag,{status:status as PacketHandoffStatus}));
    assert.ok(html.includes(label));
  }
});
test('PO summary renders only its period counts and own UA details without packet narratives',()=>{
  const period={
    start_date:'2026-11-23',end_date:'2026-11-23',log_count:1,reviewed_log_count:1,
    activity:{trafficStops:3},rating_counts:{NO:0,A:0,RT:0,UA:1,NRT:0},
    reviewed_run_checklists:2,total_runs:2,
  };
  const totals={
    daily:period,weekly:{...period,start_date:'2026-11-22',end_date:'2026-11-28'},
    monthly:{...period,start_date:'2026-11-01',end_date:'2026-11-30'},
    unacceptable_details:[{record_date:'2026-11-23',category_key:'driving',rating:'UA',justification:'TEST Own UA exact Case.'}],
  } as unknown as PacketPoTotals;
  const html=renderToStaticMarkup(createElement(PoPacketSummary,{totals}));
  for(const visible of ['Daily','Weekly','Monthly','traffic Stops','2 / 2','TEST Own UA exact Case.'])
    assert.ok(html.includes(visible),`missing ${visible}`);
  for(const hidden of ['TEST Narrative','TEST Run CAD','TEST Recruit Comment'])
    assert.ok(!html.includes(hidden));
});
test('review document preserves authored case, checklist values, extended rating fields and additional report details',()=>{
  // Presentation-only fixture, never stored or sent to the operational API.
  const detail={
    submission:{review_note:'TEST Written Coordinator Reason'},
    report:{id:'TEST-report',date:'2026-11-22',phase:1,className:'TEST ONLY',
      recruitName:'TEST PO',recruitBadge:'TEST-1',ftoName:'TEST FTO',ftoBadge:'TEST-2',
      reportingForDuty:{checklist:{test_duty_item:true},notes:'TEST Duty Note'},
      runs:[{runKind:'traffic_stop',narrative:'TEST Run MiXeD CAD',
        checklist:{test_primary_answer:true},directiveReviews:{traffic_stop:{otherDetails:'TEST SUPPLEMENT DETAIL'}}}],
      activity:{test_total:3},ratings:{test_category:{rating:'NRT',justification:'TEST Justification',
        nrtCorrectiveActions:'TEST Corrective Actions',nrtCoordinatorsNotified:true}},
      narrative:'TEST Authored MiXeD <script>not executable</script>',
      remedial:'TEST Remedial Notes',recruitComments:'TEST Recruit Comments',
      additionalLegacyField:'TEST Legacy Detail',signatures:[{name:'TEST Signer'}],
    },history:[{action:'CORRECTION_REQUESTED',occurred_at:'2026-11-22T12:00:00Z',note:'TEST History Note'}],
  } as unknown as PacketSubmissionDetail;
  const html=renderToStaticMarkup(createElement(PacketDocument,{detail}));
  for(const text of ['TEST Run MiXeD CAD','TEST SUPPLEMENT DETAIL','TEST Corrective Actions',
    'TEST Legacy Detail','TEST Signer','TEST History Note','TEST Written Coordinator Reason'])
    assert.ok(html.includes(text),`missing ${text}`);
  assert.ok(html.includes('TEST Authored MiXeD &lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(detail.report);
  assert.equal(detail.report.narrative,'TEST Authored MiXeD <script>not executable</script>');
});
test('packet document fails closed when the report is null',()=>{
  const detail={submission:{},report:null,po_totals:null,history:[]} as unknown as PacketSubmissionDetail;
  const html=renderToStaticMarkup(createElement(PacketDocument,{detail}));
  assert.ok(html.includes('packet-report-hidden'));
  assert.ok(!html.includes('text-narrative'));
  assert.ok(!html.includes('text-recruit-comments'));
});
