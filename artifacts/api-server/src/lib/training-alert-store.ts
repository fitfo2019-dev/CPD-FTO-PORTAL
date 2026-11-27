import type pg from "pg";
import { randomUUID } from "node:crypto";
import type { AgencyIdentity } from "../security/agencyIdentity.js";
import { PacketError } from "./packet-errors.js";
import { getAgencyDatabasePool } from "./agency-database.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";

export type AlertKind = "NRT" | "NRT_REVIEW_REQUEST" | "NOT_RELEASE";
export type AlertNotice = AlertKind | "NOT_RELEASE_CHANGED";
export type TrainingAlert = {
  id: string; kind: AlertKind; po_name: string; po_badge: string; class_name: string; phase: number;
  fto_name: string; coordinator_id: string; category: string | null; record_date: string | null;
  report_ids: string[]; summary: string; week15_choice: "release" | "not_release" | null;
  week15_changed_at: string | null; created_at: string; state: "open" | "closed";
  closed_by_name: string | null; closed_by_role: "FTO_COORDINATOR" | "FTO_SGT" | null; closed_at: string | null; close_note: string;
};
type Queryable = pg.Pool | pg.PoolClient;

// ISO 8601 with offset, so every screen converts to the reader's local time.
const iso = (column: string) => `to_json(t.${column})#>>'{}' AS ${column}`;
const alertColumns = `t.id,t.kind,t.po_name,t.po_badge,t.class_name,t.phase,t.fto_name,t.coordinator_id,
 t.category,t.record_date::text AS record_date,t.report_ids,t.summary,t.week15_choice,
 ${iso("week15_changed_at")},${iso("created_at")},t.state,
 t.closed_by_name,t.closed_by_role,${iso("closed_at")},t.close_note`;

/** Alerts are optional until the agency applies agency-training-alerts.sql. A
 * missing table must never block packet finalization. */
export async function alertsInstalled(client: Queryable): Promise<boolean> {
  const result = await client.query<{ installed: boolean }>(
    "SELECT to_regclass('agency_training.training_alerts') IS NOT NULL AS installed");
  return result.rows[0]?.installed === true;
}

async function event(client: Queryable, alertId: string, identity: AgencyIdentity, action: string, note = "") {
  await client.query(`INSERT INTO agency_training.training_alert_events (alert_id,actor_hash,action,note)
    VALUES ($1,$2,$3,$4)`, [alertId, hashUserIdentifier(identity.id), action, note]);
}

/** Queue one notice per recipient: the PO's assigned Coordinator and every FTO Sergeant. */
async function queueNotices(client: Queryable, alertId: string, coordinatorId: string, notice: AlertNotice) {
  await client.query(`INSERT INTO agency_training.alert_email_outbox (alert_id,recipient_id,notice)
    SELECT $1,r.identity_id,$3 FROM agency_training.alert_recipients r
    WHERE r.active AND ((r.role='FTO_COORDINATOR' AND r.identity_id=$2) OR r.role='FTO_SGT')
    ON CONFLICT (alert_id,recipient_id,notice) DO NOTHING`, [alertId, coordinatorId, notice]);
}

type ReportLike = {
  limboDay?: unknown; ratings?: unknown; recruitName?: unknown; ftoName?: unknown;
  className?: unknown; phase?: unknown; date?: unknown;
};
const text = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";

export function nrtCategories(report: ReportLike): string[] {
  if (report.limboDay === true || !report.ratings || typeof report.ratings !== "object") return [];
  return Object.entries(report.ratings as Record<string, unknown>)
    .filter(([key, entry]) => /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(key) && !!entry && typeof entry === "object"
      && (entry as { rating?: unknown }).rating === "NRT")
    .map(([key]) => key).sort();
}

/** Called inside the finalization transaction, after the Coordinator was resolved. */
export async function recordNrtAlertsForSubmission(client: pg.PoolClient, identity: AgencyIdentity, input: {
  packetId: string; poId: string; poBadge: string; coordinatorId: string; report: ReportLike;
}): Promise<number> {
  const categories = nrtCategories(input.report);
  if (!categories.length || !(await alertsInstalled(client))) return 0;
  const phase = Number(input.report.phase);
  let created = 0;
  for (const category of categories) {
    const id = randomUUID();
    const result = await client.query(`INSERT INTO agency_training.training_alerts
      (id,kind,po_id,po_badge,po_name,class_name,phase,coordinator_id,fto_id,fto_name,source_packet_id,category,record_date,report_ids)
      VALUES ($1,'NRT',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,ARRAY[$10]::text[])
      ON CONFLICT (source_packet_id,category) WHERE kind='NRT' DO NOTHING RETURNING id`,
      [id, input.poId, input.poBadge, text(input.report.recruitName, 200), text(input.report.className, 120),
        Number.isInteger(phase) && phase >= 1 && phase <= 4 ? phase : 1, input.coordinatorId, identity.id,
        text(input.report.ftoName, 200), input.packetId, category,
        /^\d{4}-\d{2}-\d{2}$/.test(text(input.report.date, 10)) ? text(input.report.date, 10) : null]);
    if (!result.rows.length) continue;
    created += 1;
    await event(client, id, identity, "CREATED");
    await queueNotices(client, id, input.coordinatorId, "NRT");
  }
  return created;
}

async function transaction<T>(pool: pg.Pool, run: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await run(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

/** The FTO must be actively assigned to the PO; the PO's Coordinator comes from the trusted mapping. */
async function assignedPo(client: Queryable, identity: AgencyIdentity, poBadge: string) {
  if (identity.role !== "FTO") throw new PacketError(403, "ALERT_FORBIDDEN");
  const result = await client.query<{ po_id: string; po_badge: string; po_name: string; class_name: string;
    phase: number; fto_name: string; coordinator_id: string }>(
    `SELECT a.po_id,a.po_badge,a.po_name,a.class_name,a.phase,a.fto_name,pc.coordinator_id
     FROM agency_training.assignments a
     JOIN agency_training.po_coordinators pc ON pc.po_id=a.po_id AND pc.po_id_hash=a.po_id_hash
     JOIN agency_training.coordinator_directory d ON d.id=pc.coordinator_id AND d.active
     WHERE a.active AND a.fto_id=$1 AND a.fto_badge=$2 AND a.fto_id_hash=$3 AND a.fto_badge_hash=$4
       AND a.po_badge=$5 AND a.po_id IS NOT NULL AND current_date BETWEEN a.starts_on AND a.ends_on
     ORDER BY a.phase DESC LIMIT 1`,
    [identity.id, identity.badge, hashUserIdentifier(identity.id), hashUserIdentifier(identity.badge), poBadge]);
  const row = result.rows[0];
  if (!row) throw new PacketError(403, "ALERT_ASSIGNMENT_REQUIRED");
  return row;
}

function readerScope(identity: AgencyIdentity): { where: string; params: unknown[] } {
  switch (identity.role) {
    case "FTO_SGT": return { where: "true", params: [] };
    case "FTO_COORDINATOR": return { where: "t.coordinator_id=$1", params: [identity.id] };
    case "FTO": return { where: "t.fto_id=$1", params: [identity.id] };
    default: throw new PacketError(403, "ALERT_FORBIDDEN");
  }
}

export function createTrainingAlertStore(pool: pg.Pool) {
  async function requireInstalled() {
    if (!(await alertsInstalled(pool))) throw new PacketError(503, "ALERTS_NOT_INSTALLED");
  }
  return {
    async list(identity: AgencyIdentity, state: "open" | "closed") {
      await requireInstalled();
      const scope = readerScope(identity);
      const result = await pool.query<TrainingAlert>(
        `SELECT ${alertColumns} FROM agency_training.training_alerts t
         WHERE ${scope.where} AND t.state=$${scope.params.length + 1}
         ORDER BY COALESCE(t.week15_changed_at,t.created_at) DESC,t.id LIMIT 200`, [...scope.params, state]);
      return { items: result.rows };
    },
    /** Records the verified sign-in email of a Coordinator or FTO Sergeant for notices. */
    async registerRecipient(identity: AgencyIdentity, email: string | null) {
      if (identity.role !== "FTO_COORDINATOR" && identity.role !== "FTO_SGT") return;
      if (!email || !(await alertsInstalled(pool))) return;
      await pool.query(`INSERT INTO agency_training.alert_recipients (identity_id,role,email)
        VALUES ($1,$2,$3) ON CONFLICT (identity_id) DO UPDATE
        SET role=EXCLUDED.role,email=EXCLUDED.email,active=true,updated_at=now()
        WHERE agency_training.alert_recipients.email IS DISTINCT FROM EXCLUDED.email
           OR agency_training.alert_recipients.role IS DISTINCT FROM EXCLUDED.role
           OR NOT agency_training.alert_recipients.active`, [identity.id, identity.role, email.slice(0, 320)]);
    },
    async requestNrtReview(identity: AgencyIdentity, input: { po_badge: string; report_ids: string[]; summary: string }) {
      await requireInstalled();
      return transaction(pool, async client => {
        const po = await assignedPo(client, identity, input.po_badge);
        const id = randomUUID();
        await client.query(`INSERT INTO agency_training.training_alerts
          (id,kind,po_id,po_badge,po_name,class_name,phase,coordinator_id,fto_id,fto_name,report_ids,summary)
          VALUES ($1,'NRT_REVIEW_REQUEST',$2,$3,$4,$5,$6,$7,$8,$9,$10::text[],$11)`,
          [id, po.po_id, po.po_badge, po.po_name, po.class_name, po.phase, po.coordinator_id, identity.id, po.fto_name,
            input.report_ids, input.summary]);
        await event(client, id, identity, "CREATED");
        await queueNotices(client, id, po.coordinator_id, "NRT_REVIEW_REQUEST");
        const saved = await client.query<TrainingAlert>(`SELECT ${alertColumns} FROM agency_training.training_alerts t WHERE t.id=$1`, [id]);
        return saved.rows[0];
      });
    },
    /** Not release opens an alert as soon as it is saved; a later change is shown on the same alert. */
    async saveWeek15(identity: AgencyIdentity, input: { po_badge: string; choice: "release" | "not_release" }) {
      await requireInstalled();
      return transaction(pool, async client => {
        const po = await assignedPo(client, identity, input.po_badge);
        if (po.phase !== 4) throw new PacketError(422, "WEEK15_PHASE_IV_REQUIRED");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`week15:${po.po_id}`]);
        const open = await client.query<{ id: string; week15_choice: string }>(
          `SELECT id,week15_choice FROM agency_training.training_alerts
           WHERE kind='NOT_RELEASE' AND state='open' AND po_id=$1`, [po.po_id]);
        const existing = open.rows[0];
        let id: string | null = existing?.id ?? null;
        if (!existing && input.choice === "not_release") {
          id = randomUUID();
          await client.query(`INSERT INTO agency_training.training_alerts
            (id,kind,po_id,po_badge,po_name,class_name,phase,coordinator_id,fto_id,fto_name,week15_choice)
            VALUES ($1,'NOT_RELEASE',$2,$3,$4,$5,4,$6,$7,$8,'not_release')`,
            [id, po.po_id, po.po_badge, po.po_name, po.class_name, po.coordinator_id, identity.id, po.fto_name]);
          await event(client, id, identity, "CREATED");
          await queueNotices(client, id, po.coordinator_id, "NOT_RELEASE");
        } else if (existing && existing.week15_choice !== input.choice) {
          await client.query(`UPDATE agency_training.training_alerts SET week15_choice=$2,week15_changed_at=now() WHERE id=$1`,
            [existing.id, input.choice]);
          await event(client, existing.id, identity, "WEEK15_CHANGED", input.choice);
          await queueNotices(client, existing.id, po.coordinator_id, input.choice === "release" ? "NOT_RELEASE_CHANGED" : "NOT_RELEASE");
        }
        if (!id) return { alert: null };
        const saved = await client.query<TrainingAlert>(`SELECT ${alertColumns} FROM agency_training.training_alerts t WHERE t.id=$1`, [id]);
        return { alert: saved.rows[0] ?? null };
      });
    },
    async close(identity: AgencyIdentity, id: string, note: string, closerName: string | null = null) {
      if (identity.role !== "FTO_COORDINATOR" && identity.role !== "FTO_SGT") throw new PacketError(403, "ALERT_CLOSE_FORBIDDEN");
      if (!note.trim()) throw new PacketError(400, "ALERT_CLOSE_NOTE_REQUIRED");
      await requireInstalled();
      return transaction(pool, async client => {
        const scope = readerScope(identity);
        const found = await client.query<{ id: string; state: string }>(
          `SELECT t.id,t.state FROM agency_training.training_alerts t
           WHERE ${scope.where} AND t.id=$${scope.params.length + 1} FOR UPDATE`, [...scope.params, id]);
        const row = found.rows[0];
        if (!row) throw new PacketError(404, "ALERT_NOT_FOUND");
        if (row.state === "closed") throw new PacketError(409, "ALERT_ALREADY_CLOSED");
        await client.query(`UPDATE agency_training.training_alerts
          SET state='closed',closed_by_hash=$2,closed_by_name=$5,closed_by_role=$3,closed_at=now(),close_note=$4 WHERE id=$1`,
          [id, hashUserIdentifier(identity.id), identity.role, note.trim(), closerName?.trim().slice(0, 200) || null]);
        await event(client, id, identity, "CLOSED", note.trim());
        const saved = await client.query<TrainingAlert>(`SELECT ${alertColumns} FROM agency_training.training_alerts t WHERE t.id=$1`, [id]);
        return saved.rows[0];
      });
    },
  };
}
export type TrainingAlertStore = ReturnType<typeof createTrainingAlertStore>;
let store: TrainingAlertStore | undefined;
export function getTrainingAlertStore(): TrainingAlertStore | null {
  const pool = getAgencyDatabasePool();
  if (!pool) return null;
  store ??= createTrainingAlertStore(pool);
  return store;
}
