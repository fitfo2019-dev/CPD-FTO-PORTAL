import { Router, type IRouter, type Response } from "express";
import {
  CreateTestAdminParticipantBody, CreateTestAdminClassBody, CreateTestAdminAssignmentBody,
  UpdateTestAdminParticipantParams,
} from "@workspace/api-zod";
import { resolveClerkSession, stagingError, type SessionResolver } from "./access.js";
import { StagingFailure, type StagingContext } from "./repository.js";
import { stagingGate } from "./router.js";
import type { TestAdminRepository } from "./test-admin-repository.js";

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/u;
const cleanLabels = (...values: string[]) => values.every(value => value.trim() === value && value.length > 0 && !CONTROL_CHARACTERS.test(value));

/**
 * Test-administrator scenario routes. Resolver injection exists only for
 * tests; the mounted router always uses resolveClerkSession. The TEST_ADMIN
 * role is resolved in SQL inside every request; nothing from the browser
 * selects or grants it.
 */
export function createTestAdminRouter(repository: TestAdminRepository, resolveSession: SessionResolver = resolveClerkSession): IRouter {
  const router = Router();
  const prefix = "/v1/staging/test-admin";
  router.use(prefix, stagingGate(resolveSession));
  // Test authority is never presented as an agency principal.
  const context = (res: Response): StagingContext => res.locals.stagingContext;
  const fail = (res: Response, error: unknown): void => {
    if (error instanceof StagingFailure) {
      stagingError(res, error.status, error.code, "The synthetic scenario operation is not permitted or conflicts with current state.");
      return;
    }
    stagingError(res, 503, "STAGING_UNAVAILABLE", "The synthetic staging service is unavailable.");
  };
  const run = (res: Response, work: () => Promise<unknown>, status = 200): void => {
    work().then(data => { res.status(status).json(data); }, error => fail(res, error));
  };
  const id = (req: { params: unknown }, res: Response): string | null => {
    const parsed = UpdateTestAdminParticipantParams.strict().safeParse(req.params);
    if (!parsed.success) { stagingError(res, 400, "INVALID_ID", "A valid identifier is required."); return null; }
    return parsed.data.id;
  };

  router.get(`${prefix}/scenario`, (_req, res) => run(res, () => repository.scenario(context(res))));
  router.get(`${prefix}/audit`, (_req, res) => run(res, () => repository.auditHistory(context(res))));

  const participantBody = (body: unknown, res: Response) => {
    const parsed = CreateTestAdminParticipantBody.strict().safeParse(body);
    if (!parsed.success || !cleanLabels(parsed.data.display_label, parsed.data.badge_label)) {
      stagingError(res, 422, "INVALID_PARTICIPANT", "A fictional name, badge and role are required."); return null;
    }
    return parsed.data;
  };
  router.post(`${prefix}/participants`, (req, res) => {
    const body = participantBody(req.body, res); if (!body) return;
    run(res, () => repository.createParticipant(context(res), body), 201);
  });
  router.put(`${prefix}/participants/:id`, (req, res) => {
    const target = id(req, res); if (!target) return;
    const body = participantBody(req.body, res); if (!body) return;
    run(res, () => repository.updateParticipant(context(res), target, body));
  });

  const classBody = (body: unknown, res: Response) => {
    const parsed = CreateTestAdminClassBody.strict().safeParse(body);
    if (!parsed.success || !cleanLabels(parsed.data.label)) {
      stagingError(res, 422, "INVALID_CLASS", "A class name and coordinator are required."); return null;
    }
    return parsed.data;
  };
  router.post(`${prefix}/classes`, (req, res) => {
    const body = classBody(req.body, res); if (!body) return;
    run(res, () => repository.createClass(context(res), body), 201);
  });
  router.put(`${prefix}/classes/:id`, (req, res) => {
    const target = id(req, res); if (!target) return;
    const body = classBody(req.body, res); if (!body) return;
    run(res, () => repository.updateClass(context(res), target, body));
  });

  const assignmentBody = (body: unknown, res: Response) => {
    const parsed = CreateTestAdminAssignmentBody.strict().safeParse(body);
    if (!parsed.success || parsed.data.po_id === parsed.data.fto_id) {
      stagingError(res, 422, "INVALID_ASSIGNMENT", "A class, PO, FTO, phase and valid dates are required."); return null;
    }
    return parsed.data;
  };
  router.post(`${prefix}/assignments`, (req, res) => {
    const body = assignmentBody(req.body, res); if (!body) return;
    run(res, () => repository.createAssignment(context(res), body), 201);
  });
  router.put(`${prefix}/assignments/:id`, (req, res) => {
    const target = id(req, res); if (!target) return;
    const body = assignmentBody(req.body, res); if (!body) return;
    run(res, () => repository.updateAssignment(context(res), target, body));
  });

  for (const [segment, type] of [["participants", "PARTICIPANT"], ["classes", "CLASS"], ["assignments", "ASSIGNMENT"]] as const) {
    router.post(`${prefix}/${segment}/:id/deactivation`, (req, res) => {
      const target = id(req, res); if (!target) return;
      if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
        stagingError(res, 422, "UNEXPECTED_BODY", "Deactivation takes no input."); return;
      }
      run(res, () => repository.deactivate(context(res), type, target));
    });
  }
  return router;
}
