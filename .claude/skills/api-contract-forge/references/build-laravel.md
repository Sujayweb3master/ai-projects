# Laravel (PHP) — Build Templates

> **Response contract:** All responses MUST follow the standard envelope defined in `references/response-contract.md`.

Use these templates when the project detection (Step 0.1) identifies Laravel. Adapt all placeholder tokens to the actual resource name.

Generate: Controller, FormRequest, API Resource, Model, Migration, Route. Generate only the operations the user requested.

---

## File 1: FormRequest — `app/Http/Requests/Create{Resource}Request.php`

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class Create{Resource}Request extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Handle auth via middleware
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|min:1|max:200',
            'amount' => 'required|numeric|min:0',
            'status' => 'nullable|in:draft,sent,paid',
        ];
    }
}
```

### Update Request — `app/Http/Requests/Update{Resource}Request.php`

```php
<?php

namespace App\Http\Requests;

class Update{Resource}Request extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'sometimes|string|min:1|max:200',
            'amount' => 'sometimes|numeric|min:0',
            'status' => 'sometimes|in:draft,sent,paid',
        ];
    }
}
```

Using `sometimes` instead of `nullable` for update requests means the field is only validated if it's present in the request — this supports true partial updates.

---

## File 2: API Resource — `app/Http/Resources/{Resource}Resource.php`

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class {Resource}Resource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'amount' => $this->amount,
            'status' => $this->status,
            'createdAt' => $this->created_at->toISOString(),
            'updatedAt' => $this->updated_at->toISOString(),
        ];
    }
}
```

API Resources control the exact shape of the JSON response — this prevents accidental field exposure and keeps the response contract consistent regardless of model changes.

---

## File 3: Controller — `app/Http/Controllers/{Resource}Controller.php`

```php
<?php

namespace App\Http\Controllers;

use App\Models\{Resource};
use App\Http\Requests\Create{Resource}Request;
use App\Http\Requests\Update{Resource}Request;
use App\Http\Resources\{Resource}Resource;
use Illuminate\Http\Request;

class {Resource}Controller extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request)
    {
        $query = {Resource}::query();

        if ($search = $request->query('search')) {
            $query->where('title', 'ILIKE', "%{$search}%");
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $page = max((int) $request->query('page', 1), 1);
        $limit = min(max((int) $request->query('limit', 10), 1), 100);
        $total = $query->count();
        $items = $query->orderByDesc('created_at')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        return response()->json([
            'status' => true,
            'message' => 'Data retrieved',
            'data' => [
                'items' => {Resource}Resource::collection($items),
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int) ceil($total / $limit),
            ],
            'error' => null,
        ]);
    }

    public function store(Create{Resource}Request $request)
    {
        $resource = {Resource}::create($request->validated());

        return response()->json([
            'status' => true,
            'message' => '{Resource} created',
            'data' => new {Resource}Resource($resource),
            'error' => null,
        ], 201);
    }

    public function show(string $id)
    {
        $resource = {Resource}::findOrFail($id);

        return response()->json([
            'status' => true,
            'message' => '{Resource} retrieved',
            'data' => new {Resource}Resource($resource),
            'error' => null,
        ]);
    }

    public function update(Update{Resource}Request $request, string $id)
    {
        $resource = {Resource}::findOrFail($id);
        $resource->update($request->validated());

        return response()->json([
            'status' => true,
            'message' => '{Resource} updated',
            'data' => new {Resource}Resource($resource->fresh()),
            'error' => null,
        ]);
    }

    public function destroy(string $id)
    {
        $resource = {Resource}::findOrFail($id);
        $resource->delete();
        return response()->noContent();
    }
}
```

---

## File 4: Model — `app/Models/{Resource}.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class {Resource} extends Model
{
    use HasUuids;

    protected $fillable = ['title', 'amount', 'status'];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    protected $attributes = [
        'status' => 'draft',
    ];
}
```

---

## File 5: Migration

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('{resources}', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title', 200);
            $table->decimal('amount', 12, 2);
            $table->enum('status', ['draft', 'sent', 'paid'])->default('draft');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('{resources}');
    }
};
```

---

## File 6: Routes — `routes/api.php`

```php
use App\Http\Controllers\{Resource}Controller;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::apiResource('{resources}', {Resource}Controller::class);
});
```

`Route::apiResource` automatically wires index, store, show, update, destroy to the controller. If the user requested only specific operations, use individual `Route::get`, `Route::post`, etc. instead.

---

## File 7: Exception Handler — `app/Exceptions/Handler.php`

Override the default exception handler to return errors in the standard contract format:

```php
<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    public function render($request, Throwable $e)
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return $this->renderApiException($request, $e);
        }

        return parent::render($request, $e);
    }

    protected function renderApiException($request, Throwable $e)
    {
        if ($e instanceof ValidationException) {
            return response()->json([
                'status' => false,
                'message' => 'Validation Failed',
                'data' => null,
                'error' => [
                    'type' => 'validation_error',
                    'detail' => 'One or more fields failed validation.',
                    'traceId' => request()->header('X-Trace-Id', (string) \Illuminate\Support\Str::uuid()),
                    'errors' => collect($e->errors())->flatMap(fn ($messages, $field) =>
                        collect($messages)->map(fn ($msg) => [
                            'field' => $field,
                            'message' => $msg,
                        ])
                    )->values()->all(),
                ],
            ], 422);
        }

        if ($e instanceof ModelNotFoundException) {
            return response()->json([
                'status' => false,
                'message' => 'Resource Not Found',
                'data' => null,
                'error' => [
                    'type' => 'not_found',
                    'detail' => 'The requested resource was not found.',
                    'traceId' => request()->header('X-Trace-Id', (string) \Illuminate\Support\Str::uuid()),
                ],
            ], 404);
        }

        $status = $e instanceof HttpException ? $e->getStatusCode() : 500;

        return response()->json([
            'status' => false,
            'message' => 'Internal Server Error',
            'data' => null,
            'error' => [
                'type' => 'server_error',
                'detail' => app()->isProduction() ? 'An unexpected error occurred.' : $e->getMessage(),
                'traceId' => request()->header('X-Trace-Id', (string) \Illuminate\Support\Str::uuid()),
            ],
        ], $status);
    }
}
```

This ensures all error responses — validation, not-found, and server errors — follow the unified envelope (`{ status: false, message, data: null, error: { type, detail, traceId, errors } }`).
