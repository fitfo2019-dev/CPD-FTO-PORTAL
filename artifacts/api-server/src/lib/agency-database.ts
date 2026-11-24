import pg from "pg";
let pool:pg.Pool|undefined;
export type AgencyDatabaseConfig={connectionString:string;max:4;connectionTimeoutMillis:3000;idleTimeoutMillis:10000;statement_timeout:10000};
/** The project/DATABASE_URL used by detached synthetic staging is never a
 * fallback for operational packet storage. */
export function agencyDatabaseConfig(environment:NodeJS.ProcessEnv=process.env):AgencyDatabaseConfig|null {
  const connectionString=environment.AGENCY_DATABASE_URL?.trim();
  if(environment.AGENCY_PACKET_SYNC_ENABLED!=="true"||!connectionString)return null;
  return {connectionString,max:4,connectionTimeoutMillis:3000,idleTimeoutMillis:10000,statement_timeout:10000};
}
export function getAgencyDatabasePool():pg.Pool|null {
  const config=agencyDatabaseConfig();
  if(!config)return null;
  if(!pool) {
    pool=new pg.Pool(config);
    pool.on("error",()=>{});
  }
  return pool;
}
