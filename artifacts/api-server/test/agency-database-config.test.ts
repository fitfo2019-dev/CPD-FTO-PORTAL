import test from "node:test";
import assert from "node:assert/strict";
import {agencyDatabaseConfig} from "../src/lib/agency-database.js";

test("agency packet storage never falls back to a detached staging DATABASE_URL",()=>{
  assert.equal(agencyDatabaseConfig({DATABASE_URL:"postgres://synthetic.test/db"} as NodeJS.ProcessEnv),null);
  assert.equal(agencyDatabaseConfig({DATABASE_URL:"postgres://synthetic.test/db",AGENCY_PACKET_SYNC_ENABLED:"false",
    AGENCY_DATABASE_URL:"postgres://agency.test/db"} as NodeJS.ProcessEnv),null);
});
test("agency storage requires the explicit gate and dedicated secret setting",()=>{
  const config=agencyDatabaseConfig({
    DATABASE_URL:"postgres://synthetic.test/db",AGENCY_PACKET_SYNC_ENABLED:"true",
    AGENCY_DATABASE_URL:" postgres://agency.test/db ", AGENCY_PACKET_TEST_ENV_APPROVED:"true",
    NODE_ENV:"test",
  } as NodeJS.ProcessEnv);
  assert.deepEqual(config,{
    connectionString:"postgres://agency.test/db",max:4,connectionTimeoutMillis:3000,
    idleTimeoutMillis:10000,statement_timeout:10000,
  });
});
test("agency storage stays unavailable without approval and in production",()=>{
  const base={
    AGENCY_PACKET_SYNC_ENABLED:"true",AGENCY_DATABASE_URL:"postgres://agency.test/db",
    AGENCY_PACKET_TEST_ENV_APPROVED:"true",
  };
  assert.equal(agencyDatabaseConfig({...base,NODE_ENV:"test",AGENCY_PACKET_TEST_ENV_APPROVED:"false"} as NodeJS.ProcessEnv),null);
  assert.equal(agencyDatabaseConfig({...base,NODE_ENV:"production"} as NodeJS.ProcessEnv),null);
});
