# Build Patterns — Special Requirement Templates

These are cross-framework patterns triggered when the user selects special requirements in Phase 0.2 (GATHER). Each pattern shows the concept and framework-specific implementation guidance.

Read this file when the user requests any of: file upload, soft delete, relationship loading/population, or advanced search/filtering.

---

## Table of Contents

1. [File Upload Endpoints](#file-upload)
2. [Soft Delete](#soft-delete)
3. [Relationship Loading](#relationship-loading)
4. [Advanced Search & Filtering](#advanced-filtering)

---

## 1. File Upload Endpoints {#file-upload}

File upload endpoints use `multipart/form-data` instead of JSON. This changes the validation schema, middleware, Swagger docs, and storage logic.

### Validation Schema

The upload schema validates the file itself (type, size) plus any metadata fields sent alongside it.

**Express + Zod:**
```typescript
export const upload{Resource}FileSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.string().optional(),
});

// File validation happens in middleware (multer), not Zod.
// Zod validates the text fields in the multipart body.
```

**FastAPI + Pydantic:**
```python
from fastapi import UploadFile, File, Form

@router.post("/{resources}/{id}/upload")
async def upload_{resource}_file(
    id: str,
    file: UploadFile = File(..., description="File to upload"),
    title: str = Form(None),
    category: str = Form(None),
):
    # Validate file
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, f"File type {file.content_type} not allowed")
    if file.size > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(400, "File too large (max 10MB)")
    ...
```

### Route Pattern

File upload is typically a sub-resource endpoint, not part of the main CRUD:

```
POST   /api/v1/{resources}/:id/files      — Upload file(s)
GET    /api/v1/{resources}/:id/files      — List files for resource
DELETE /api/v1/{resources}/:id/files/:fileId — Delete specific file
```

### Middleware

**Express (multer):**
```typescript
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(), // or diskStorage for local
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }
  },
});

/**
 * @swagger
 * /api/v1/{resources}/{id}/files:
 *   post:
 *     summary: Upload a file for {resource}
 *     tags: [{Resources}]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: The file to upload
 *       - in: formData
 *         name: title
 *         type: string
 *         required: false
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid file type or size
 */
router.post(
  "/:id/files",
  authenticate,
  upload.single("file"),
  asyncHandler({resource}Controller.uploadFile)
);
```

**NestJS:**
```typescript
@Post(':id/files')
@UseInterceptors(FileInterceptor('file'))
@ApiConsumes('multipart/form-data')
uploadFile(
  @Param('id') id: string,
  @UploadedFile(new ParseFilePipe({
    validators: [
      new FileTypeValidator({ fileType: /(jpeg|png|pdf)$/ }),
      new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
    ],
  })) file: Express.Multer.File,
) { ... }
```

**Laravel:**
```php
public function uploadFile(Request $request, string $id)
{
    $request->validate([
        'file' => 'required|file|mimes:jpeg,png,pdf|max:10240',
        'title' => 'nullable|string|max:200',
    ]);

    $path = $request->file('file')->store("{resources}/{$id}", 'public');
    ...
}
```

**Go (Gin):**
```go
func (h *{Resource}Handler) UploadFile(c *gin.Context) {
    file, err := c.FormFile("file")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
        return
    }
    if file.Size > 10<<20 { // 10MB
        c.JSON(http.StatusBadRequest, gin.H{"error": "File too large"})
        return
    }
    // Save file...
}
```

### Service Layer

Keep storage logic in the service, not the controller. The service should handle:
- Generating a unique filename (UUID + original extension)
- Uploading to storage (local disk, S3, GCS, Azure Blob)
- Saving file metadata (path, size, mimetype, uploadedBy) to the database
- Returning the file URL or signed URL

### Response Shape

```json
{
  "id": "file-uuid",
  "filename": "report.pdf",
  "originalName": "Q4 Report.pdf",
  "mimetype": "application/pdf",
  "size": 524288,
  "url": "https://storage.example.com/resources/123/file-uuid.pdf",
  "uploadedBy": "user-uuid",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

---

## 2. Soft Delete {#soft-delete}

Soft delete marks records as deleted without physically removing them from the database. This preserves data for auditing, recovery, and referential integrity.

### Database Schema Changes

Add a `deletedAt` timestamp field (null = active, non-null = deleted):

**Prisma:**
```prisma
model {Resource} {
  id        String    @id @default(uuid())
  title     String
  // ... other fields
  deletedAt DateTime? // null = active, timestamp = soft-deleted
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

**SQLAlchemy:**
```python
class {Resource}Model(Base):
    # ... other fields
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
```

**TypeORM / NestJS:**
```typescript
@DeleteDateColumn()
deletedAt: Date | null;
```
TypeORM has built-in soft delete support — `@DeleteDateColumn` auto-populates on `softDelete()` and auto-filters on `find()`.

**Laravel:**
```php
use Illuminate\Database\Eloquent\SoftDeletes;

class {Resource} extends Model
{
    use SoftDeletes; // Auto-adds deleted_at handling
}
```
Laravel's `SoftDeletes` trait handles everything — queries auto-filter, `delete()` soft-deletes, `forceDelete()` hard-deletes, `withTrashed()` includes deleted.

**Rails:**
```ruby
# Using paranoia gem or discard gem
class {Resource} < ApplicationRecord
  include Discard::Model # adds discarded_at column
  default_scope -> { kept } # auto-filter deleted records
end
```

### Service Layer Changes

The key principle: all normal queries filter out deleted records by default, and deletion sets `deletedAt` instead of removing the row.

**Express + Prisma service:**
```typescript
export class {Resource}Service {
  // All reads filter out soft-deleted records
  async findAll(query: {Resource}QueryInput) {
    const where: any = { deletedAt: null }; // Only active records
    // ... rest of query building
  }

  async findById(id: string) {
    const item = await prisma.{resource}.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw { message: "{RESOURCE}_NOT_FOUND", statusCode: 404 };
    return item;
  }

  // Soft delete — set timestamp instead of removing
  async delete(id: string) {
    await this.findById(id);
    return prisma.{resource}.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Restore — clear the deletedAt timestamp
  async restore(id: string) {
    const item = await prisma.{resource}.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    if (!item) throw { message: "{RESOURCE}_NOT_FOUND", statusCode: 404 };
    return prisma.{resource}.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // Hard delete — actually remove from database (admin only)
  async hardDelete(id: string) {
    return prisma.{resource}.delete({ where: { id } });
  }

  // Include deleted records (for admin views)
  async findAllWithDeleted(query: {Resource}QueryInput) {
    // Don't add deletedAt: null filter
  }
}
```

**FastAPI + SQLAlchemy service:**
```python
class {Resource}Service:
    def find_all(self, ...):
        query = self.db.query({Resource}Model).filter(
            {Resource}Model.deleted_at.is_(None)  # Only active
        )
        ...

    def delete(self, id: str):
        item = self.find_by_id(id)
        item.deleted_at = datetime.utcnow()
        self.db.commit()

    def restore(self, id: str):
        item = self.db.query({Resource}Model).filter(
            {Resource}Model.id == id,
            {Resource}Model.deleted_at.isnot(None)
        ).first()
        if not item:
            raise ValueError("{Resource} not found or not deleted")
        item.deleted_at = None
        self.db.commit()
```

### Additional Routes

Soft delete adds two extra endpoints:

```
POST   /api/v1/{resources}/:id/restore    — Restore a soft-deleted record
DELETE /api/v1/{resources}/:id/permanent  — Hard delete (admin only, if needed)
GET    /api/v1/{resources}/trash          — List soft-deleted records (admin)
```

### Swagger for Restore

```typescript
/**
 * @swagger
 * /api/v1/{resources}/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted {resource}
 *     tags: [{Resources}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: {Resource} restored successfully
 *       404:
 *         description: {Resource} not found or not deleted
 */
```

### Response Shape

Soft-deleted records should include the `deletedAt` field in admin responses, but should be completely invisible in normal queries:

```json
// Normal response — deletedAt omitted or null
{ "id": "...", "title": "...", "deletedAt": null }

// Admin/trash response — shows deletion time
{ "id": "...", "title": "...", "deletedAt": "2025-03-10T14:00:00Z" }
```

---

## 3. Relationship Loading {#relationship-loading}

APIs often need to return related data. The `?include` or `?populate` query parameter lets clients request nested resources without making multiple round trips.

### Query Parameter Pattern

```
GET /api/v1/invoices?include=company,items,assignee
GET /api/v1/invoices/123?include=company.address,items.product
```

This is important because the response shape changes based on the `include` parameter — the contract needs to reflect which relations are available and what shape they return when included.

### Validation Schema

Add `include` to the query schema with an enum of allowed relations:

**Zod (Express):**
```typescript
export const {resource}QuerySchema = z.object({
  // ... existing pagination fields
  include: z
    .string()
    .optional()
    .transform((val) => val?.split(",").map((s) => s.trim()))
    .pipe(
      z.array(z.enum([
        "company", "items", "assignee", "tags",       // Level 1
        "company.address", "items.product",            // Level 2 (dot notation)
      ])).optional()
    ),
});
```

**Pydantic (FastAPI):**
```python
from typing import List, Optional

class {Resource}QueryParams(BaseModel):
    # ... existing pagination
    include: Optional[str] = Field(
        None,
        description="Comma-separated relations to include. Use dot notation for nested: profile.skills",
        example="profile.skills,company",
    )

    @property
    def include_list(self) -> List[str]:
        if not self.include:
            return []
        allowed = {"company", "items", "assignee", "tags",
                   "company.address", "items.product"}  # Level 2 includes
        requested = {s.strip() for s in self.include.split(",")}
        return list(requested & allowed)  # Only return allowed relations
```

### Service Layer — ORM-Specific Loading

**Prisma (Express/NestJS):**
```typescript
async findAll(query: {Resource}QueryInput) {
  const include: Record<string, boolean> = {};
  if (query.include) {
    const allowed = ["company", "items", "assignee", "tags"];
    for (const rel of query.include) {
      if (allowed.includes(rel)) {
        include[rel] = true;
      }
    }
  }

  const items = await prisma.{resource}.findMany({
    where,
    include: Object.keys(include).length > 0 ? include : undefined,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
  });
  // ...
}
```

**SQLAlchemy (FastAPI):**
```python
from sqlalchemy.orm import joinedload

def find_all(self, query):
    q = self.db.query({Resource}Model)

    for rel in query.include_list:
        if hasattr({Resource}Model, rel):
            q = q.options(joinedload(getattr({Resource}Model, rel)))

    # ... pagination
```

**Mongoose (Express):**
```typescript
async findAll(query: {Resource}QueryInput) {
  let q = {Resource}Model.find(where);

  if (query.include) {
    const allowed = ["company", "items", "assignee"];
    for (const rel of query.include) {
      if (allowed.includes(rel)) {
        q = q.populate(rel);
      }
    }
  }

  // ...
}
```

**TypeORM (NestJS):**
```typescript
async findAll(query: {Resource}QueryDto) {
  const relations: string[] = [];
  if (query.include) {
    const allowed = ["company", "items", "assignee"];
    relations.push(...query.include.filter(r => allowed.includes(r)));
  }

  return this.repo.find({
    where,
    relations,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });
}
```

**Django REST (ViewSet):**
```python
class {Resource}ViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        qs = super().get_queryset()
        include = self.request.query_params.get("include", "")
        allowed = {"company", "items", "assignee"}
        requested = set(include.split(",")) & allowed
        if requested:
            qs = qs.select_related(*[r for r in requested if is_fk(r)])
            qs = qs.prefetch_related(*[r for r in requested if is_m2m(r)])
        return qs
```

**Laravel:**
```php
public function index(Request $request)
{
    $query = {Resource}::query();

    $allowed = ['company', 'items', 'assignee', 'tags'];
    if ($include = $request->query('include')) {
        $relations = array_intersect(explode(',', $include), $allowed);
        $query->with($relations);
    }
    // ...
}
```

### Nested Includes (Dot Notation)

For multi-level nesting like `?include=profile.skills`, the ORM needs to load nested relations:

**Prisma (Express/NestJS):**
```typescript
// Parse "profile.skills" into nested Prisma include
function buildPrismaInclude(includes: string[], allowedTree: Record<string, string[]>) {
  const result: Record<string, any> = {};
  for (const inc of includes) {
    const parts = inc.split(".");
    if (parts.length === 1 && parts[0] in allowedTree) {
      result[parts[0]] = true;
    } else if (parts.length === 2 && parts[0] in allowedTree && allowedTree[parts[0]].includes(parts[1])) {
      // Nested: profile.skills → { profile: { include: { skills: true } } }
      result[parts[0]] = { include: { [parts[1]]: true } };
    }
  }
  return result;
}

// Usage:
const allowedTree = {
  profile: ["skills", "certifications"],
  company: ["departments"],
};
const include = buildPrismaInclude(query.include, allowedTree);
// ?include=profile.skills → { profile: { include: { skills: true } } }
```

**SQLAlchemy (FastAPI/Django):**
```python
from sqlalchemy.orm import joinedload

def build_eager_loading(query, includes, allowed_tree):
    for inc in includes:
        parts = inc.split(".")
        if len(parts) == 1 and parts[0] in allowed_tree:
            query = query.options(joinedload(getattr(Model, parts[0])))
        elif len(parts) == 2 and parts[0] in allowed_tree:
            if parts[1] in allowed_tree[parts[0]]:
                # profile.skills → joinedload(User.profile).joinedload(Profile.skills)
                parent = joinedload(getattr(Model, parts[0]))
                query = query.options(parent.joinedload(getattr(ParentModel, parts[1])))
    return query
```

**Laravel:**
```php
// ?include=profile.skills → with(['profile.skills'])
// Laravel supports dot notation natively
$allowed = ['profile', 'profile.skills', 'company', 'company.departments'];
$requested = array_intersect(explode(',', $include), $allowed);
$query->with($requested);
```

**Rails:**
```ruby
# ?include=profile.skills → includes(profile: :skills)
allowed_tree = {
  'profile' => [],
  'profile.skills' => [:profile, { profile: :skills }],
  'company' => [],
}
requested.each do |inc|
  if allowed_tree.key?(inc)
    case inc
    when 'profile.skills'
      resources = resources.includes(profile: :skills)
    when 'profile'
      resources = resources.includes(:profile)
    end
  end
end
```

**Null Handling at Each Level:**

When a parent relation is null, nested loading stops gracefully:

```typescript
// Prisma handles this automatically:
// User has no profile → profile: null, skills not loaded
// User has profile but no skills → profile: { ..., skills: [] }

// In your serializer/response, ensure:
// - null parent → "profile": null (don't crash on .skills of null)
// - empty array → "skills": [] (never null)
```

### Swagger Documentation

Document which relations are available and what shape they add:

```typescript
/**
 * @swagger
 * /api/v1/{resources}:
 *   get:
 *     parameters:
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *           example: "company,items"
 *         description: |
 *           Comma-separated list of relations to include.
 *           Available: company, items, assignee, tags.
 *           When included, the relation object replaces the ID field.
 */
```

### Response Shape Contract

Document what changes when relations are included:

```typescript
// Without include
interface {Resource}Response {
  id: string;
  title: string;
  companyId: string;       // Just the ID
  assigneeId: string;      // Just the ID
}

// With ?include=company,assignee
interface {Resource}WithRelations {
  id: string;
  title: string;
  companyId: string;
  company: CompanyResponse;     // Full object added
  assigneeId: string;
  assignee: AssigneeResponse;   // Full object added
}
```

### Security consideration

Always whitelist allowed relations — never pass user input directly to the ORM's include/populate. Unrestricted includes can cause: N+1 queries and DB overload, exposure of sensitive related data, and circular reference loops.

---

## 4. Advanced Search & Filtering {#advanced-filtering}

Beyond basic text search and single-enum filters, production APIs need date ranges, numeric ranges, and multi-value enum filtering.

### Query Parameter Conventions

Use suffixed parameter names to indicate the filter operation:

| Filter Type | Parameter Pattern | Example |
|---|---|---|
| **Date range** | `{field}After`, `{field}Before` | `createdAfter=2025-01-01&createdBefore=2025-03-01` |
| **Numeric range** | `{field}Min`, `{field}Max` | `amountMin=100&amountMax=500` |
| **Multi-value enum** | `{field}` (comma-separated) | `status=draft,sent` |
| **Boolean** | `{field}` | `isActive=true` |
| **Null check** | `{field}IsNull` | `assigneeIsNull=true` |
| **Text search** | `search` (global) or `{field}Like` | `search=urgent` or `titleLike=Q4` |

This naming convention (suffix-based) is clearer than operator-style (`field[gte]=100`) for most APIs and easier to type-check.

### Validation Schema

**Zod (Express):**
```typescript
export const {resource}QuerySchema = z.object({
  // Pagination (existing)
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),

  // Text search
  search: z.string().optional(),

  // Multi-value enum — accept comma-separated, parse to array
  status: z
    .string()
    .optional()
    .transform((val) => val?.split(",").map((s) => s.trim()))
    .pipe(z.array(z.enum(["draft", "sent", "paid"])).optional()),

  // Date range
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),

  // Numeric range
  amountMin: z.coerce.number().min(0).optional(),
  amountMax: z.coerce.number().min(0).optional(),

  // Boolean filter
  isActive: z.coerce.boolean().optional(),

  // Null check
  assigneeIsNull: z.coerce.boolean().optional(),

  // Relationship include
  include: z.string().optional()
    .transform((val) => val?.split(",").map((s) => s.trim()))
    .pipe(z.array(z.enum(["company", "items", "assignee"])).optional()),
}).refine(
  (data) => {
    // Validate date range logic
    if (data.createdAfter && data.createdBefore) {
      return data.createdAfter <= data.createdBefore;
    }
    return true;
  },
  { message: "createdAfter must be before createdBefore" }
).refine(
  (data) => {
    if (data.amountMin !== undefined && data.amountMax !== undefined) {
      return data.amountMin <= data.amountMax;
    }
    return true;
  },
  { message: "amountMin must be less than or equal to amountMax" }
);
```

**Pydantic (FastAPI):**
```python
from datetime import datetime
from pydantic import model_validator

class {Resource}QueryParams(BaseModel):
    # Pagination
    page: int = Field(1, ge=1)
    limit: int = Field(10, ge=1, le=100)
    sort_by: str = "created_at"
    sort_order: str = "desc"

    # Text search
    search: Optional[str] = None

    # Multi-value enum
    status: Optional[str] = Field(
        None, description="Comma-separated: draft,sent,paid"
    )

    # Date range
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None

    # Numeric range
    amount_min: Optional[float] = Field(None, ge=0)
    amount_max: Optional[float] = Field(None, ge=0)

    # Boolean
    is_active: Optional[bool] = None

    # Null check
    assignee_is_null: Optional[bool] = None

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.created_after and self.created_before:
            if self.created_after > self.created_before:
                raise ValueError("created_after must be before created_before")
        if self.amount_min is not None and self.amount_max is not None:
            if self.amount_min > self.amount_max:
                raise ValueError("amount_min must be <= amount_max")
        return self

    @property
    def status_list(self) -> list[str]:
        if not self.status:
            return []
        allowed = {"draft", "sent", "paid"}
        return [s.strip() for s in self.status.split(",") if s.strip() in allowed]
```

### Service Layer — Building the Where Clause

**Prisma (Express):**
```typescript
async findAll(query: {Resource}QueryInput) {
  const where: any = {};

  // Text search
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  // Multi-value enum
  if (query.status?.length) {
    where.status = { in: query.status };
  }

  // Date range
  if (query.createdAfter || query.createdBefore) {
    where.createdAt = {};
    if (query.createdAfter) where.createdAt.gte = query.createdAfter;
    if (query.createdBefore) where.createdAt.lte = query.createdBefore;
  }

  // Numeric range
  if (query.amountMin !== undefined || query.amountMax !== undefined) {
    where.amount = {};
    if (query.amountMin !== undefined) where.amount.gte = query.amountMin;
    if (query.amountMax !== undefined) where.amount.lte = query.amountMax;
  }

  // Boolean filter
  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  // Null check
  if (query.assigneeIsNull === true) {
    where.assigneeId = null;
  } else if (query.assigneeIsNull === false) {
    where.assigneeId = { not: null };
  }

  // ... pagination and include logic
}
```

**SQLAlchemy (FastAPI):**
```python
def find_all(self, query):
    q = self.db.query({Resource}Model).filter(
        {Resource}Model.deleted_at.is_(None)
    )

    if query.search:
        q = q.filter(or_(
            {Resource}Model.title.ilike(f"%{query.search}%"),
            {Resource}Model.description.ilike(f"%{query.search}%"),
        ))

    if query.status_list:
        q = q.filter({Resource}Model.status.in_(query.status_list))

    if query.created_after:
        q = q.filter({Resource}Model.created_at >= query.created_after)
    if query.created_before:
        q = q.filter({Resource}Model.created_at <= query.created_before)

    if query.amount_min is not None:
        q = q.filter({Resource}Model.amount >= query.amount_min)
    if query.amount_max is not None:
        q = q.filter({Resource}Model.amount <= query.amount_max)

    if query.is_active is not None:
        q = q.filter({Resource}Model.is_active == query.is_active)

    if query.assignee_is_null is True:
        q = q.filter({Resource}Model.assignee_id.is_(None))
    elif query.assignee_is_null is False:
        q = q.filter({Resource}Model.assignee_id.isnot(None))

    # ... pagination
```

### Swagger Documentation

Document every filter parameter with type, format, and example:

```typescript
/**
 * @swagger
 * /api/v1/{resources}:
 *   get:
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: "draft,sent"
 *         description: Comma-separated status filter (draft, sent, paid)
 *       - in: query
 *         name: createdAfter
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2025-01-01T00:00:00Z"
 *         description: Filter records created after this date
 *       - in: query
 *         name: createdBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter records created before this date
 *       - in: query
 *         name: amountMin
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Minimum amount (inclusive)
 *       - in: query
 *         name: amountMax
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Maximum amount (inclusive)
 *       - in: query
 *         name: assigneeIsNull
 *         schema:
 *           type: boolean
 *         description: Filter by whether assignee is null (true) or not null (false)
 */
```

### Performance consideration

For advanced filtering, consider adding database indexes on commonly filtered columns (status, createdAt, amount). Without indexes, date range and numeric range queries degrade quickly on large tables. Mention this in the wiring step (Phase 0.4) when generating the migration.
