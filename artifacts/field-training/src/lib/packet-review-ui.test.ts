import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {PacketSubmissionDetail,PacketSubmissionState} from '@workspace/api-client-react';
import {PacketDocument,StatusTag} from '../components/packet-review/packet-view.js';

test('receipt never renders as COMPLETE; only approved packets use that label',()=>{
  for(const [state,label] of Object.entries({
    submitted:'SUBMITTED',acknowledged:'PACKET ACKNOWLEDGE',approved:'COMPLETE',correction_requested:'CORRECTION REQUESTED',
  })){
    const html=renderToStaticMarkup(createElement(StatusTag,{state:state as PacketSubmissionState}));
    assert.ok(html.includes(label));
    if(state!=='approved') assert.ok(!html.includes('COMPLETE'));
  }
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
  assert.equal(detail.report.narrative,'TEST Authored MiXeD <script>not executable</script>');
});
