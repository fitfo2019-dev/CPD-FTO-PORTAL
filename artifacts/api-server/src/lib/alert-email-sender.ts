import type pg from "pg";
import type { AlertNotice } from "./training-alert-store.js";
import { alertsInstalled } from "./training-alert-store.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";

/** "off" until configured. "test" renders each queued notice into the server
 * log and never contacts a mail server. The department mail relay sender is
 * added once department IT provides the relay host, port, TLS, login and
 * from address. */
export type AlertEmailMode = "off" | "test";

/** Marker for notices the test sender rendered. The row stays 'queued', so the
 * relay sender still delivers it later. */
export const TEST_MODE_MARK = "TEST_MODE_NOT_SENT";

export function alertEmailMode(environment: NodeJS.ProcessEnv = process.env): { mode: AlertEmailMode; unknown?: string } {
  const value = environment.ALERT_EMAIL_MODE?.trim().toLowerCase() ?? "";
  if (value === "" || value === "off") return { mode: "off" };
  if (value === "test") return { mode: "test" };
  return { mode: "off", unknown: value };
}

export type NoticeMessage = { subject: string; text: string };

const NOTICE_TEXT: Record<AlertNotice, NoticeMessage> = {
  NRT: { subject: "FTO Portal alert: NRT rating",
    text: "A Daily Performance Summary with an NRT rating was finalized." },
  NRT_REVIEW_REQUEST: { subject: "FTO Portal alert: NRT review request",
    text: "An FTO requested an NRT review." },
  NOT_RELEASE: { subject: "FTO Portal alert: Week 15 Not release",
    text: "An FTO saved a Week 15 recommendation of Not release." },
  NOT_RELEASE_CHANGED: { subject: "FTO Portal alert: Week 15 recommendation changed",
    text: "An FTO changed a Week 15 recommendation from Not release to Release." },
};

/** Notice only: no names, badges, ratings, categories or dates. */
export function renderNotice(notice: AlertNotice, portalUrl?: string): NoticeMessage {
  const base = NOTICE_TEXT[notice];
  const link = portalUrl && /^https:\/\/[^\s]+$/.test(portalUrl) ? ` ${portalUrl}` : "";
  return { subject: base.subject, text: `${base.text} Sign in to the FTO Portal to review the alert.${link}` };
}

/** The test transport receives no email address, only a hash of the recipient. */
export type TestNotice = NoticeMessage & { outboxId: string; notice: AlertNotice; recipientHash: string };
export type TestTransport = (message: TestNotice) => void;

/** One pass over notices the test sender has not rendered yet. Inactive
 * recipients are skipped. */
export async function runTestEmailPass(pool: pg.Pool, transport: TestTransport,
  options: { limit?: number; portalUrl?: string } = {}): Promise<{ rendered: number }> {
  if (!(await alertsInstalled(pool))) return { rendered: 0 };
  const rows = await pool.query<{ id: string; notice: AlertNotice; recipient_id: string }>(
    `SELECT o.id::text AS id,o.notice,o.recipient_id FROM agency_training.alert_email_outbox o
       JOIN agency_training.alert_recipients r ON r.identity_id=o.recipient_id
      WHERE o.status='queued' AND o.last_error_code='' AND r.active
      ORDER BY o.id LIMIT $1`, [options.limit ?? 25]);
  let rendered = 0;
  for (const row of rows.rows) {
    transport({ outboxId: row.id, notice: row.notice, recipientHash: hashUserIdentifier(row.recipient_id),
      ...renderNotice(row.notice, options.portalUrl) });
    await pool.query(`UPDATE agency_training.alert_email_outbox SET last_error_code=$2
      WHERE id=$1 AND status='queued' AND last_error_code=''`, [row.id, TEST_MODE_MARK]);
    rendered += 1;
  }
  return { rendered };
}
