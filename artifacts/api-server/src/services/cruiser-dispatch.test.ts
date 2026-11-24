import assert from "node:assert/strict";
import test from "node:test";
import {fetchPatrolViewUnitEvent} from "./patrolViewIntegration.js";
import {fetchPatrolViewIncident} from "./patrolViewIncidentIntegration.js";
import {parseOperationalIdentity} from "@workspace/api-zod/operational-profile";

const config={
  PATROLVIEW_API_TOKEN:"fictional-test-token",
  PATROLVIEW_EVENT_LOOKUP_URL:"https://fictional.invalid/event/{eventId}",
  PATROLVIEW_INCIDENT_LOOKUP_URL:"https://fictional.invalid/incident/{incidentNumber}",
};
const response=(data:unknown)=>async()=>new Response(JSON.stringify(data),{status:200});
test("unsided CAD matching does not accept physical cruiser, sided tokens, other units or missing unit",async()=>{
  for(const unit of ["9150","9150E-1","9150E-2","9150D","9150EE",undefined]){
    assert.deepEqual(await fetchPatrolViewUnitEvent("TEST","9150E",config,response({
      unitNumber:unit,eventIngressAt:"2026-11-24T12:00:00Z",
    })),{});
  }
  const accepted=await fetchPatrolViewUnitEvent("TEST","9150E",config,response({
    unit_number:" 9150e ",eventIngressAt:"2026-11-24T12:00:00Z",officerName:"NOT FOR BROWSER",
  }));
  assert.deepEqual(accepted,{eventIngressAt:"2026-11-24T12:00:00.000Z",cadIdentity:parseOperationalIdentity("9150E")});
  for(const ownUnit of ["9150E","9150E-1","9150E-2"]) {
    for(const otherUnit of ["9150E","9150E-1","9150E-2"]) {
      const event=await fetchPatrolViewUnitEvent("TEST",ownUnit,config,response({unitNumber:otherUnit,incidentNumber:"TEST"}));
      assert.deepEqual(event,ownUnit===otherUnit?{incidentNumber:"TEST",cadIdentity:parseOperationalIdentity(ownUnit)}:{});
    }
  }
  for(const unit of [{unitNumber:"9150E",unit_number:"9150E-1"},{unitNumber:"9150E",cadUnit:"9150D"},
    {unitNumber:"9150E-3"},{units:[{unitNumber:"9150E"},{unitNumber:"9150E"}]}]) {
    assert.deepEqual(await fetchPatrolViewUnitEvent("TEST","9150E",config,response(unit)),{});
  }
});
test("incident lookup returns only the exact normalized CAD unit's own clocks",async()=>{
  const rows=await fetchPatrolViewIncident("TEST","9150E",config,response({
    incidentNumber:"TEST",units:[
      {unitNumber:"9150",dispatchedAt:"2026-11-24T10:00:00Z"},
      {unitNumber:"9150E-1",dispatchedAt:"2026-11-24T11:00:00Z"},
      {unitNumber:"9150D",dispatchedAt:"2026-11-24T12:00:00Z"},
      {unitNumber:" 9150e ",dispatchedAt:"2026-11-24T13:00:00Z"},
    ],
  }));
  assert.equal(rows.length,1);
  assert.equal(rows[0].dispatchedAt,"2026-11-24T13:00:00.000Z");
  assert.equal(rows[0].cadIdentity?.districtToken,"9150");
  for(const ownUnit of ["9150E","9150E-1","9150E-2"]) {
    const result=await fetchPatrolViewIncident("TEST",ownUnit,config,response({
      incidentNumber:"TEST",units:["9150E","9150E-1","9150E-2"].map(unitNumber=>({unitNumber,dispatchedAt:"2026-11-24T10:00:00Z"})),
    }));
    assert.equal(result.length,1);
    assert.equal(result[0].cadIdentity?.cadUnit,ownUnit);
  }
  await assert.rejects(fetchPatrolViewIncident("TEST","9150E",config,response({
    incidentNumber:"TEST",units:[{unitNumber:"9150E",unit_number:"9150E-2"}],
  })));
});
