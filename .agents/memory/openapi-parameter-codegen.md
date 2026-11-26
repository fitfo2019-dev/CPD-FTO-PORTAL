---
name: OpenAPI parameter code generation
description: Avoid Orval/Zod generated parameter-name collisions and unsupported methods on coerced query strings.
---

When an OpenAPI operation has both path parameters and query parameters, Orval can generate colliding `*Params` symbols between the Zod schema module and generated TypeScript parameter types. Prefer a query-only parameter contract when that fits the resource design, or otherwise choose an operation/parameter shape that avoids the duplicate export. For UUID query values, express UUID validation with explicit length and pattern constraints rather than `format: uuid`, which can generate `.uuid()` on `zod.coerce.string()` and fail typechecking under the current Zod baseline.

**Why:** The workspace codegen emitted duplicate parameter exports and an invalid Zod coercion method while adding cursor pagination.

**How to apply:** After changing OpenAPI request parameters, run codegen and its chained typecheck before wiring the generated client into the server or portal.
