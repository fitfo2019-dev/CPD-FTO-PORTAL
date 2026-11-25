import assert from "node:assert/strict";
import { test } from "node:test";
import { getClerkProxyHost } from "../src/middlewares/clerkProxyMiddleware.ts";

test("Clerk proxy uses a validated Express-resolved host", () => {
  assert.equal(
    getClerkProxyHost({ hostname: "portal.example.gov" }),
    "portal.example.gov",
  );
  assert.equal(
    getClerkProxyHost({ hostname: "portal.example.gov/path" }),
    undefined,
  );
  assert.equal(
    getClerkProxyHost({ hostname: "portal.example.gov?next=other.example" }),
    undefined,
  );
});
