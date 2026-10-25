# Express + TypeScript — Build Templates

> **Response contract:** All responses MUST conform to the standard envelope defined in [`references/response-contract.md`](./response-contract.md). See that file for the canonical single-item, list, delete, and error shapes.

Use these templates when the project detection (Step 0.1) identifies Express as the framework. Adapt all placeholder tokens (`{resource}`, `{Resource}`, `{resources}`, `{Resources}`, `{RESOURCE}`) to the actual resource name.

Generate only the files needed for the operations the user requested. If they asked for only Create (POST), skip update schemas, list queries, and the corresponding route/controller/service methods.

---

## File 1: Validation Schema — `src/types/{resource}.types.ts`

```typescript
import { z } from "zod"; // or Joi, depending on detection

// CREATE schema
export const create{Resource}Schema = z.object({
  // Fields with validation rules
  title: z.string().min(1).max(200),
  amount: z.number().min(0),
  status: z.enum(["draft", "sent", "paid"]).default("draft"),
  // Relations
  companyId: z.string().uuid(),
});

export type Create{Resource}Input = z.infer<typeof create{Resource}Schema>;

// UPDATE schema (all fields optional)
export const update{Resource}Schema = create{Resource}Schema.partial();
export type Update{Resource}Input = z.infer<typeof update{Resource}Schema>;

// QUERY schema (for list filtering/pagination)
export const {resource}QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(["draft", "sent", "paid"]).optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type {Resource}QueryInput = z.infer<typeof {resource}QuerySchema>;
```

### Validation rules

- Use `.min()` / `.max()` for strings and numbers
- Use `.email()`, `.uuid()`, `.url()` for format validation
- Use `.enum()` for fixed value sets
- Use `.default()` for fields with defaults
- Use `.optional()` for non-required fields
- Use `.nullable()` for explicitly nullable fields
- Use `.refine()` for custom validation logic
- Derive all TypeScript types from schemas with `z.infer<>` — this avoids type drift between validation and the type system

---

## File 2: Routes — `src/routes/{resource}.routes.ts`

```typescript
import { Router } from "express";
// Import from detected middleware patterns
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { validateBody, validateQuery, validateParams } from "../middlewares/validation.middleware";
import { asyncHandler } from "../middlewares/error.middleware";
import { create{Resource}Schema, update{Resource}Schema, {resource}QuerySchema } from "../types/{resource}.types";
import { {resource}Controller } from "../controllers/{resource}.controller";

const router = Router();

// Apply auth middleware to all routes (if detected in project)
router.use(authenticate);

/**
 * @swagger
 * /api/v1/{resources}:
 *   post:
 *     summary: Create a new {resource}
 *     tags: [{Resources}]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Create{Resource}'
 *     responses:
 *       201:
 *         description: {Resource} created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/{Resource}Response'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  requirePermission("{resources}.create"),
  validateBody(create{Resource}Schema),
  asyncHandler({resource}Controller.create{Resource})
);

/**
 * @swagger
 * /api/v1/{resources}:
 *   get:
 *     summary: List {resources} with pagination
 *     tags: [{Resources}]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sent, paid]
 *     responses:
 *       200:
 *         description: {Resources} retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Paginated{Resource}Response'
 */
router.get(
  "/",
  requirePermission("{resources}.view.all"),
  validateQuery({resource}QuerySchema),
  asyncHandler({resource}Controller.get{Resources})
);

// GET /:id, PUT /:id, DELETE /:id — same pattern with swagger JSDoc

export default router;
```

### Swagger rules

Every route needs `@swagger` JSDoc. Include `tags`, `security`, `parameters`, `requestBody`, `responses`. Reference `$ref` schemas under `components/schemas`. Document all response codes (200, 201, 400, 401, 403, 404, 500) — this is important because undocumented error codes confuse frontend developers and break code generators.

---

## File 3: Controller — `src/controllers/{resource}.controller.ts`

> **Important:** The response helpers (`sendSuccess`, `sendPaginatedResponse`, `sendError`) used below MUST produce the unified envelope (`{ status, message, data, error }`) defined in [`references/response-contract.md`](./response-contract.md). Do not use raw `res.json()` — always go through these helpers to guarantee contract compliance.

```typescript
import { Request, Response, NextFunction } from "express";
// Use detected response helpers
import { sendSuccess, sendError, sendPaginatedResponse } from "../utils/response";
import { {resource}Service } from "../services/{resource}.service";

export class {Resource}Controller {
  async create{Resource}(req: Request, res: Response): Promise<void> {
    try {
      const result = await {resource}Service.create(req.body);
      // sendSuccess produces: { status: true, message: "...", data: { ...result }, error: null }
      sendSuccess(res, result, req.t("{RESOURCE}_CREATED"), 201);
    } catch (error: any) {
      // sendError produces: { status: false, message: "...", data: null, error: { type, detail, traceId, errors } }
      sendError(res, req.t(error.message), error.statusCode || 500);
    }
  }

  async get{Resources}(req: Request, res: Response): Promise<void> {
    try {
      const { items, total } = await {resource}Service.findAll(req.query as any);
      const { page, limit } = req.query as any;
      // sendPaginatedResponse produces:
      // { status: true, message: "...", data: { items: [...], total, page, limit, totalPages }, error: null }
      sendPaginatedResponse(res, items, total, page, limit, req.t("DATA_RETRIEVED"));
    } catch (error: any) {
      sendError(res, req.t("REQUEST_FAILED"), 500, error.message);
    }
  }

  // getById  — use sendSuccess  -> { status: true, message, data, error: null }
  // update   — use sendSuccess  -> { status: true, message, data, error: null }
  // delete   — use res.status(204).send()  (empty body, no JSON envelope)
}

export const {resource}Controller = new {Resource}Controller();
```

### Controller rules

- Use the project's detected response helpers — raw `res.json()` breaks the response contract and makes it impossible to maintain a consistent envelope across endpoints
- Use the project's detected i18n pattern for messages
- Wrap all handlers in try/catch (or use detected asyncHandler)
- Keep controllers thin — delegate logic to service layer
- Use the project's detected request type (AuthenticatedRequest, etc.)

---

## File 4: Service — `src/services/{resource}.service.ts`

```typescript
// Use detected ORM
import { prisma } from "../config/database";
import { Create{Resource}Input, Update{Resource}Input, {Resource}QueryInput } from "../types/{resource}.types";

export class {Resource}Service {
  async create(data: Create{Resource}Input) {
    return prisma.{resource}.create({ data });
  }

  async findAll(query: {Resource}QueryInput) {
    const { page, limit, search, status, sortBy, sortOrder } = query;
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.{resource}.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.{resource}.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string) {
    const item = await prisma.{resource}.findUnique({ where: { id } });
    if (!item) throw { message: "{RESOURCE}_NOT_FOUND", statusCode: 404 };
    return item;
  }

  async update(id: string, data: Update{Resource}Input) {
    await this.findById(id); // throws if not found
    return prisma.{resource}.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id);
    return prisma.{resource}.delete({ where: { id } });
  }
}

export const {resource}Service = new {Resource}Service();
```

### Service rules

- Use the detected ORM syntax (Prisma, Mongoose, TypeORM, Sequelize, etc.)
- All input parameters use types derived from Zod schemas — this ensures runtime validation and compile-time types are always in sync
- Include pagination, search, and filter logic for list operations
- Throw structured errors with message and statusCode
- Keep DB queries in services, never in controllers — this makes testing and reuse much easier
