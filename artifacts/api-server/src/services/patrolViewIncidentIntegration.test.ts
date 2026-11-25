import assert from 'node:assert/strict';
import test from 'node:test';
import {fetchPatrolViewIncident,mapPatrolViewIncident} from './patrolViewIncidentIntegration.js';
import {fetchPatrolViewJson,PatrolViewIntegrationError} from './patrolViewIntegration.js';

const incident={
  incidentNumber:'FICTIONAL-100',location:'Fictional location',dispatchedCode:'10-17A',
  eventDate:'2026-11-23',locationAddress:'100 Fictional Street',locationCity:'Fictional City',
  locationState:'OH',locationZip:'43215',zone:'TEST-ZONE',cruiserDistrict:'TEST-DISTRICT',clearanceCode:'3V',
  eventIngressAt:'2026-11-23T14:00:00Z',
  dispatchedAt:'2026-11-23T13:00:00Z',clearedAt:'2026-11-23T23:00:00Z',
  callerName:'FICTIONAL CALLER',callerPhone:'555-0100',callNotes:'FICTIONAL PRIVATE NOTES',
  units:[
    {unit_number:'TEST-A',officerName:'FICTIONAL OFFICER A',dispatched_at:'2026-11-23T14:01:00Z',cleared_at:'2026-11-23T15:00:00Z'},
    {unit_number:'TEST-B',officerName:'FICTIONAL OFFICER B',dispatched_at:'2026-11-23T14:05:00Z',cleared_at:'2026-11-23T16:00:00Z'},
  ],
};
test('each unit on a shared incident retains its own clock values and inherits common fields',()=>{
  const rows=mapPatrolViewIncident(incident,'FICTIONAL-100');
  assert.equal(rows.length,2);
  assert.equal(rows[0].dispatchedAt,'2026-11-23T14:01:00.000Z');
  assert.equal(rows[1].dispatchedAt,'2026-11-23T14:05:00.000Z');
  assert.equal(rows[0].clearedAt,'2026-11-23T15:00:00.000Z');
  assert.equal(rows[1].clearedAt,'2026-11-23T16:00:00.000Z');
  assert.equal(rows[1].location,'Fictional location');
  assert.equal(rows[1].dispatchedCode,'17A');
  assert.equal(rows[1].eventDate,'2026-11-23');
  assert.equal(rows[1].locationAddress,'100 Fictional Street');
  assert.equal(rows[1].locationCity,'Fictional City');
  assert.equal(rows[1].locationState,'OH');
  assert.equal(rows[1].locationZip,'43215');
  assert.equal(rows[1].zone,'TEST-ZONE');
  assert.equal(rows[1].cruiserDistrict,'TEST-DISTRICT');
  assert.equal(rows[1].clearanceCode,'3V');
  assert.equal('runKind' in rows[0],false,'Run type is selected from local verified mappings, not copied from upstream');
  assert.equal('officerName' in rows[0],false);
  assert.equal('callerName' in rows[0],false);
});
test('incident dispatch and clear times populate every PO run while unit-specific times override them',()=>{
  const shared=mapPatrolViewIncident({incidentNumber:'FICTIONAL-100',dispatchTime:'2026-11-23T14:00:00Z',clearTime:'2026-11-23T15:30:00Z',units:[{unitNumber:'TEST-A'},{unitNumber:'TEST-B',dispatchedAt:'2026-11-23T14:05:00Z'}]},'FICTIONAL-100');
  assert.equal(shared[0].dispatchedAt,'2026-11-23T14:00:00.000Z');
  assert.equal(shared[0].clearedAt,'2026-11-23T15:30:00.000Z');
  assert.equal(shared[1].dispatchedAt,'2026-11-23T14:05:00.000Z');
  assert.equal(shared[1].clearedAt,'2026-11-23T15:30:00.000Z');
});
test('unit rows inherit shared incident clocks; unitless times are not attributed to an officer',()=>{
  const [unit]=mapPatrolViewIncident({...incident,units:[{unitNumber:'TEST-C',runKind:'AMBIGUOUS'}]},'FICTIONAL-100');
  assert.equal(unit.dispatchedAt,'2026-11-23T13:00:00.000Z');
  assert.equal(unit.clearedAt,'2026-11-23T23:00:00.000Z');
  assert.equal('runKind' in unit,false);
  const [shared]=mapPatrolViewIncident({incidentNumber:'FICTIONAL-100',dispatchedAt:incident.dispatchedAt},'FICTIONAL-100');
  assert.equal(shared.dispatchedAt,undefined);
});
test('rejects wrong incidents, invalid clocks and oversized unit lists',()=>{
  assert.throws(()=>mapPatrolViewIncident(incident,'OTHER-INCIDENT'),PatrolViewIntegrationError);
  assert.throws(()=>mapPatrolViewIncident({...incident,units:[{unitNumber:'TEST-A',dispatchedAt:'yesterday'}]},'FICTIONAL-100'),PatrolViewIntegrationError);
  assert.throws(()=>mapPatrolViewIncident({...incident,eventDate:'2026-02-30'},'FICTIONAL-100'),PatrolViewIntegrationError);
  assert.throws(()=>mapPatrolViewIncident({...incident,clearanceCode:'ARREST'},'FICTIONAL-100'),PatrolViewIntegrationError);
  assert.throws(()=>mapPatrolViewIncident({...incident,units:Array.from({length:101},()=>({unitNumber:'TEST'}))},'FICTIONAL-100'),PatrolViewIntegrationError);
  assert.throws(()=>mapPatrolViewIncident({status:'error',data:incident},'FICTIONAL-100'),PatrolViewIntegrationError);
});
test('unconfigured incident lookup fails closed and machine authentication never uses browser credentials',async()=>{
  await assert.rejects(fetchPatrolViewIncident('FICTIONAL-100','TEST-A',{}),{code:'PATROLVIEW_NOT_CONFIGURED'});
  const rows=await fetchPatrolViewIncident('FICTIONAL-100','TEST-B',{
    PATROLVIEW_INCIDENT_LOOKUP_URL:'https://agency-adapter.invalid/incidents/{incidentNumber}',
    PATROLVIEW_API_TOKEN:'FICTIONAL-MACHINE-TOKEN',
  },async(url,init)=>{
    assert.equal(url.pathname,'/incidents/FICTIONAL-100');
    assert.equal(new Headers(init.headers).get('authorization'),'Bearer FICTIONAL-MACHINE-TOKEN');
    assert.equal(new Headers(init.headers).has('cookie'),false);
    assert.equal(init.redirect,'error');
    return new Response(JSON.stringify(incident),{status:200,headers:{'content-type':'application/json'}});
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].unitNumber,'TEST-B','only the caller’s own unit is returned');
  assert.equal('officerName' in rows[0],false);
  assert.equal('callerName' in rows[0],false);
  assert.equal('callerPhone' in rows[0],false);
  assert.equal('callNotes' in rows[0],false);
  await assert.rejects(fetchPatrolViewIncident('FICTIONAL-100','TEST-A',{
    PATROLVIEW_INCIDENT_LOOKUP_URL:'http://agency-adapter.invalid/{incidentNumber}',PATROLVIEW_API_TOKEN:'FICTIONAL',
  }),{code:'PATROLVIEW_NOT_CONFIGURED'});
});
test('shared transport times out and redacts arbitrary upstream exceptions',async()=>{
  await assert.rejects(fetchPatrolViewJson(new URL('https://agency-adapter.invalid/'),'FICTIONAL',
    async(_url,init)=>new Promise((_resolve,reject)=>init.signal?.addEventListener('abort',()=>reject(new Error('/home/runner/private/request')),{once:true})),5),{code:'PATROLVIEW_TIMEOUT'});
  await assert.rejects(fetchPatrolViewJson(new URL('https://agency-adapter.invalid/'),'FICTIONAL',
    async()=>{throw new Error('/home/runner/private/FICTIONAL-MACHINE-TOKEN');}),error=>{
      assert.ok(error instanceof PatrolViewIntegrationError);
      assert.equal(error.code,'PATROLVIEW_UNAVAILABLE');
      assert.ok(!error.message.includes('/home/runner'));
      assert.ok(!error.message.includes('FICTIONAL-MACHINE-TOKEN'));
      return true;
    });
});
