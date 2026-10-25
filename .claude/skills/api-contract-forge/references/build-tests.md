# API Contract Tests — Response Envelope Verification

> These test templates verify that every generated endpoint produces the **unified response envelope** (`{ status, message, data, error }`). Generate the appropriate test file alongside the API code during BUILD mode.

The tests cover 6 contract rules:
1. **Success response** — `{ status: true, message: string, data: object, error: null }`
2. **Paginated response** — `data` contains `{ items, total, page, limit, totalPages }`
3. **Delete response** — `204 No Content` with empty body
4. **Validation error** — `{ status: false, message: string, data: null, error: { type, detail, traceId, errors[] } }`
5. **Not found error** — `{ status: false, message: string, data: null, error: { type, detail, traceId } }`
6. **Field naming** — All JSON fields are camelCase, dates are ISO 8601

---

## Express + TypeScript (Jest + Supertest)

**File:** `src/__tests__/{resource}.contract.test.ts`

```typescript
import request from "supertest";
import app from "../app";

const API_BASE = "/api/v1/{resources}";

// ─── Contract Shape Helpers ───

function expectSuccessEnvelope(body: any) {
  expect(body).toHaveProperty("status", true);
  expect(body).toHaveProperty("message");
  expect(typeof body.message).toBe("string");
  expect(body).toHaveProperty("data");
  expect(body.data).not.toBeNull();
  expect(body).toHaveProperty("error", null);
}

function expectErrorEnvelope(body: any) {
  expect(body).toHaveProperty("status", false);
  expect(body).toHaveProperty("message");
  expect(typeof body.message).toBe("string");
  expect(body).toHaveProperty("data", null);
  expect(body).toHaveProperty("error");
  expect(body.error).not.toBeNull();
  expect(body.error).toHaveProperty("type");
  expect(body.error).toHaveProperty("detail");
  expect(body.error).toHaveProperty("traceId");
}

function expectPaginatedData(data: any) {
  expect(data).toHaveProperty("items");
  expect(Array.isArray(data.items)).toBe(true);
  expect(data).toHaveProperty("total");
  expect(typeof data.total).toBe("number");
  expect(data).toHaveProperty("page");
  expect(typeof data.page).toBe("number");
  expect(data).toHaveProperty("limit");
  expect(typeof data.limit).toBe("number");
  expect(data).toHaveProperty("totalPages");
  expect(typeof data.totalPages).toBe("number");
}

function expectCamelCaseKeys(obj: any) {
  const snakeCaseRegex = /^[a-z]+(_[a-z]+)+$/;
  for (const key of Object.keys(obj)) {
    expect(key).not.toMatch(snakeCaseRegex);
  }
}

function expectISODate(value: string) {
  expect(new Date(value).toISOString()).toBe(value);
}

// ─── Contract Tests ───

describe("{Resource} API — Response Contract", () => {
  let createdId: string;

  // 1. CREATE — success envelope
  it("POST / returns { status: true, data, error: null }", async () => {
    const res = await request(app)
      .post(API_BASE)
      .send({ title: "Test", amount: 100 })
      .expect(201);

    expectSuccessEnvelope(res.body);
    expect(res.body.data).toHaveProperty("id");
    expectCamelCaseKeys(res.body.data);
    if (res.body.data.createdAt) expectISODate(res.body.data.createdAt);

    createdId = res.body.data.id;
  });

  // 2. GET /:id — success envelope
  it("GET /:id returns { status: true, data, error: null }", async () => {
    const res = await request(app).get(`${API_BASE}/${createdId}`).expect(200);

    expectSuccessEnvelope(res.body);
    expect(res.body.data.id).toBe(createdId);
    expectCamelCaseKeys(res.body.data);
  });

  // 3. LIST — paginated envelope
  it("GET / returns paginated { status: true, data: { items, total, page, limit, totalPages } }", async () => {
    const res = await request(app)
      .get(`${API_BASE}?page=1&limit=10`)
      .expect(200);

    expectSuccessEnvelope(res.body);
    expectPaginatedData(res.body.data);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(10);

    if (res.body.data.items.length > 0) {
      expectCamelCaseKeys(res.body.data.items[0]);
    }
  });

  // 4. UPDATE — success envelope
  it("PUT /:id returns { status: true, data, error: null }", async () => {
    const res = await request(app)
      .put(`${API_BASE}/${createdId}`)
      .send({ title: "Updated" })
      .expect(200);

    expectSuccessEnvelope(res.body);
    expect(res.body.data.id).toBe(createdId);
  });

  // 5. DELETE — 204 empty body
  it("DELETE /:id returns 204 with empty body", async () => {
    const res = await request(app)
      .delete(`${API_BASE}/${createdId}`)
      .expect(204);

    expect(res.body).toEqual({});
  });

  // 6. VALIDATION ERROR — error envelope with errors[]
  it("POST / with invalid data returns { status: false, error.errors[] }", async () => {
    const res = await request(app)
      .post(API_BASE)
      .send({}) // empty body, should fail validation
      .expect(400);

    expectErrorEnvelope(res.body);
    expect(res.body.error).toHaveProperty("errors");
    expect(Array.isArray(res.body.error.errors)).toBe(true);
    if (res.body.error.errors.length > 0) {
      expect(res.body.error.errors[0]).toHaveProperty("field");
      expect(res.body.error.errors[0]).toHaveProperty("message");
    }
  });

  // 7. NOT FOUND — error envelope
  it("GET /:id with invalid id returns { status: false, error }", async () => {
    const res = await request(app)
      .get(`${API_BASE}/non-existent-id`)
      .expect(404);

    expectErrorEnvelope(res.body);
    expect(res.body.error.type).toContain("not-found");
  });

  // 8. EMPTY LIST — items is [], not null
  it("GET / with no results returns items as empty array", async () => {
    const res = await request(app)
      .get(`${API_BASE}?search=xxxxxxxxxnonexistent`)
      .expect(200);

    expectSuccessEnvelope(res.body);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });
});
```

---

## NestJS (Jest + Supertest)

**File:** `src/{resource}/__tests__/{resource}.contract.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { ApiExceptionFilter } from '../../common/filters/api-exception.filter';

const API_BASE = '/{resources}';

describe('{Resource} Contract Tests', () => {
  let app: INestApplication;
  let createdId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST / — success envelope with status: true', async () => {
    const { body } = await request(app.getHttpServer())
      .post(API_BASE)
      .send({ title: 'Test', amount: 100 })
      .expect(201);

    expect(body.status).toBe(true);
    expect(body.error).toBeNull();
    expect(body.data).toHaveProperty('id');
    createdId = body.data.id;
  });

  it('GET / — paginated envelope', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`${API_BASE}?page=1&limit=10`)
      .expect(200);

    expect(body.status).toBe(true);
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('page');
    expect(body.data).toHaveProperty('limit');
    expect(body.data).toHaveProperty('totalPages');
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('GET /:id — success envelope', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`${API_BASE}/${createdId}`)
      .expect(200);

    expect(body.status).toBe(true);
    expect(body.data.id).toBe(createdId);
    expect(body.error).toBeNull();
  });

  it('DELETE /:id — 204 empty body', async () => {
    const { body } = await request(app.getHttpServer())
      .delete(`${API_BASE}/${createdId}`)
      .expect(204);

    expect(body).toEqual({});
  });

  it('POST / invalid — error envelope with errors[]', async () => {
    const { body } = await request(app.getHttpServer())
      .post(API_BASE)
      .send({})
      .expect(400);

    expect(body.status).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toHaveProperty('type');
    expect(body.error).toHaveProperty('detail');
    expect(body.error).toHaveProperty('traceId');
  });

  it('GET /:id not found — error envelope', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`${API_BASE}/non-existent-id`)
      .expect(404);

    expect(body.status).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toHaveProperty('type');
    expect(body.error).toHaveProperty('traceId');
  });
});
```

---

## FastAPI (pytest)

**File:** `tests/test_{resource}_contract.py`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

API_BASE = "/api/v1/{resources}"


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def assert_success_envelope(body: dict):
    assert body["status"] is True
    assert isinstance(body["message"], str)
    assert body["data"] is not None
    assert body["error"] is None


def assert_error_envelope(body: dict):
    assert body["status"] is False
    assert isinstance(body["message"], str)
    assert body["data"] is None
    assert body["error"] is not None
    assert "type" in body["error"]
    assert "detail" in body["error"]
    assert "traceId" in body["error"]


def assert_paginated_data(data: dict):
    assert "items" in data
    assert isinstance(data["items"], list)
    assert "total" in data
    assert "page" in data
    assert "limit" in data
    assert "totalPages" in data


def assert_camel_case_keys(obj: dict):
    import re
    snake_case = re.compile(r"^[a-z]+(_[a-z]+)+$")
    for key in obj.keys():
        assert not snake_case.match(key), f"Field '{key}' is snake_case, expected camelCase"


@pytest.mark.asyncio
async def test_create_success_envelope(client):
    res = await client.post(API_BASE, json={"title": "Test", "amount": 100})
    assert res.status_code == 201
    assert_success_envelope(res.json())
    assert "id" in res.json()["data"]
    assert_camel_case_keys(res.json()["data"])


@pytest.mark.asyncio
async def test_list_paginated_envelope(client):
    res = await client.get(f"{API_BASE}?page=1&limit=10")
    assert res.status_code == 200
    body = res.json()
    assert_success_envelope(body)
    assert_paginated_data(body["data"])
    assert body["data"]["page"] == 1
    assert body["data"]["limit"] == 10


@pytest.mark.asyncio
async def test_get_by_id_success_envelope(client):
    # Create first
    create_res = await client.post(API_BASE, json={"title": "Test", "amount": 100})
    created_id = create_res.json()["data"]["id"]

    res = await client.get(f"{API_BASE}/{created_id}")
    assert res.status_code == 200
    assert_success_envelope(res.json())
    assert res.json()["data"]["id"] == created_id


@pytest.mark.asyncio
async def test_delete_204_empty_body(client):
    create_res = await client.post(API_BASE, json={"title": "ToDelete", "amount": 50})
    created_id = create_res.json()["data"]["id"]

    res = await client.delete(f"{API_BASE}/{created_id}")
    assert res.status_code == 204
    assert res.text == ""


@pytest.mark.asyncio
async def test_validation_error_envelope(client):
    res = await client.post(API_BASE, json={})
    assert res.status_code in [400, 422]
    body = res.json()
    assert_error_envelope(body)
    assert "errors" in body["error"]
    assert isinstance(body["error"]["errors"], list)


@pytest.mark.asyncio
async def test_not_found_error_envelope(client):
    res = await client.get(f"{API_BASE}/non-existent-id")
    assert res.status_code == 404
    assert_error_envelope(res.json())
```

---

## Django REST Framework (pytest-django)

**File:** `{app}/tests/test_{resource}_contract.py`

```python
import pytest
from rest_framework.test import APIClient

API_BASE = "/api/v1/{resources}/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client, django_user_model):
    user = django_user_model.objects.create_user(username="test", password="test")
    api_client.force_authenticate(user=user)
    return api_client


def assert_success_envelope(data):
    assert data["status"] is True
    assert isinstance(data["message"], str)
    assert data["data"] is not None
    assert data["error"] is None


def assert_error_envelope(data):
    assert data["status"] is False
    assert isinstance(data["message"], str)
    assert data["data"] is None
    assert data["error"] is not None
    assert "type" in data["error"]
    assert "detail" in data["error"]
    assert "traceId" in data["error"]


@pytest.mark.django_db
def test_create_success_envelope(auth_client):
    res = auth_client.post(API_BASE, {"title": "Test", "amount": "100.00"}, format="json")
    assert res.status_code == 201
    assert_success_envelope(res.data)
    assert "id" in res.data["data"]


@pytest.mark.django_db
def test_list_paginated_envelope(auth_client):
    res = auth_client.get(f"{API_BASE}?page=1&limit=10")
    assert res.status_code == 200
    assert_success_envelope(res.data)
    data = res.data["data"]
    assert "items" in data
    assert isinstance(data["items"], list)
    assert "total" in data
    assert "page" in data
    assert "limit" in data
    assert "totalPages" in data


@pytest.mark.django_db
def test_delete_204_empty(auth_client):
    create_res = auth_client.post(API_BASE, {"title": "Del", "amount": "50.00"}, format="json")
    item_id = create_res.data["data"]["id"]
    res = auth_client.delete(f"{API_BASE}{item_id}/")
    assert res.status_code == 204


@pytest.mark.django_db
def test_validation_error_envelope(auth_client):
    res = auth_client.post(API_BASE, {}, format="json")
    assert res.status_code == 400
    assert_error_envelope(res.data)
    assert "errors" in res.data["error"]


@pytest.mark.django_db
def test_not_found_error_envelope(auth_client):
    res = auth_client.get(f"{API_BASE}00000000-0000-0000-0000-000000000000/")
    assert res.status_code == 404
    assert_error_envelope(res.data)
```

---

## Go (Gin — net/http/httptest)

**File:** `handlers/{resource}_contract_test.go`

```go
package handlers_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func assertSuccessEnvelope(t *testing.T, body map[string]interface{}) {
    t.Helper()
    assert.Equal(t, true, body["status"])
    assert.NotEmpty(t, body["message"])
    assert.NotNil(t, body["data"])
    assert.Nil(t, body["error"])
}

func assertErrorEnvelope(t *testing.T, body map[string]interface{}) {
    t.Helper()
    assert.Equal(t, false, body["status"])
    assert.NotEmpty(t, body["message"])
    assert.Nil(t, body["data"])
    errorObj, ok := body["error"].(map[string]interface{})
    require.True(t, ok, "error should be an object")
    assert.NotEmpty(t, errorObj["type"])
    assert.NotEmpty(t, errorObj["detail"])
    assert.NotEmpty(t, errorObj["traceId"])
}

func parseBody(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
    t.Helper()
    var body map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &body)
    require.NoError(t, err)
    return body
}

func TestCreate_SuccessEnvelope(t *testing.T) {
    w := httptest.NewRecorder()
    payload := `{"title":"Test","amount":100}`
    req, _ := http.NewRequest("POST", "/api/v1/{resources}", bytes.NewBufferString(payload))
    req.Header.Set("Content-Type", "application/json")
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusCreated, w.Code)
    body := parseBody(t, w)
    assertSuccessEnvelope(t, body)
    data := body["data"].(map[string]interface{})
    assert.NotEmpty(t, data["id"])
}

func TestList_PaginatedEnvelope(t *testing.T) {
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("GET", "/api/v1/{resources}?page=1&limit=10", nil)
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    body := parseBody(t, w)
    assertSuccessEnvelope(t, body)
    data := body["data"].(map[string]interface{})
    assert.Contains(t, data, "items")
    assert.Contains(t, data, "total")
    assert.Contains(t, data, "page")
    assert.Contains(t, data, "limit")
    assert.Contains(t, data, "totalPages")
}

func TestDelete_204EmptyBody(t *testing.T) {
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("DELETE", "/api/v1/{resources}/some-id", nil)
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusNoContent, w.Code)
    assert.Empty(t, w.Body.String())
}

func TestValidationError_ErrorEnvelope(t *testing.T) {
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("POST", "/api/v1/{resources}", bytes.NewBufferString(`{}`))
    req.Header.Set("Content-Type", "application/json")
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusBadRequest, w.Code)
    body := parseBody(t, w)
    assertErrorEnvelope(t, body)
}

func TestNotFound_ErrorEnvelope(t *testing.T) {
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("GET", "/api/v1/{resources}/non-existent-id", nil)
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusNotFound, w.Code)
    body := parseBody(t, w)
    assertErrorEnvelope(t, body)
}
```

---

## Spring Boot (JUnit 5 + MockMvc)

**File:** `src/test/kotlin/controller/{Resource}ContractTest.kt`

```kotlin
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestMethodOrder
import org.junit.jupiter.api.MethodOrderer
import org.junit.jupiter.api.Order
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.*

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class {Resource}ContractTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    companion object {
        var createdId: String = ""
    }

    @Test
    @Order(1)
    fun `POST - success envelope with status true`() {
        val result = mockMvc.post("/api/v1/{resources}") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"Test","amount":100}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.status") { value(true) }
            jsonPath("$.message") { isString() }
            jsonPath("$.data") { isNotEmpty() }
            jsonPath("$.data.id") { isString() }
            jsonPath("$.error") { doesNotExist() }  // null serializes as absent
        }.andReturn()

        val body = com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(result.response.contentAsString)
        createdId = body["data"]["id"].asText()
    }

    @Test
    @Order(2)
    fun `GET list - paginated envelope`() {
        mockMvc.get("/api/v1/{resources}?page=1&limit=10").andExpect {
            status { isOk() }
            jsonPath("$.status") { value(true) }
            jsonPath("$.data.items") { isArray() }
            jsonPath("$.data.total") { isNumber() }
            jsonPath("$.data.page") { value(1) }
            jsonPath("$.data.limit") { value(10) }
            jsonPath("$.data.totalPages") { isNumber() }
        }
    }

    @Test
    @Order(3)
    fun `GET by id - success envelope`() {
        mockMvc.get("/api/v1/{resources}/$createdId").andExpect {
            status { isOk() }
            jsonPath("$.status") { value(true) }
            jsonPath("$.data.id") { value(createdId) }
        }
    }

    @Test
    @Order(4)
    fun `DELETE - 204 empty body`() {
        mockMvc.delete("/api/v1/{resources}/$createdId").andExpect {
            status { isNoContent() }
            content { string("") }
        }
    }

    @Test
    @Order(5)
    fun `POST invalid - error envelope`() {
        mockMvc.post("/api/v1/{resources}") {
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.status") { value(false) }
            jsonPath("$.data") { doesNotExist() }
            jsonPath("$.error.type") { isString() }
            jsonPath("$.error.detail") { isString() }
            jsonPath("$.error.traceId") { isString() }
        }
    }

    @Test
    @Order(6)
    fun `GET not found - error envelope`() {
        mockMvc.get("/api/v1/{resources}/non-existent-id").andExpect {
            status { isNotFound() }
            jsonPath("$.status") { value(false) }
            jsonPath("$.data") { doesNotExist() }
            jsonPath("$.error.type") { isString() }
            jsonPath("$.error.traceId") { isString() }
        }
    }
}
```

---

## Laravel (PHPUnit / Pest)

**File:** `tests/Feature/{Resource}ContractTest.php`

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;

class {Resource}ContractTest extends TestCase
{
    use RefreshDatabase;

    private string $apiBase = '/api/v1/{resources}';
    private string $createdId = '';

    private function authHeaders(): array
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token"];
    }

    private function assertSuccessEnvelope($response): void
    {
        $response->assertJsonStructure([
            'status', 'message', 'data', 'error'
        ]);
        $data = $response->json();
        $this->assertTrue($data['status']);
        $this->assertIsString($data['message']);
        $this->assertNotNull($data['data']);
        $this->assertNull($data['error']);
    }

    private function assertErrorEnvelope($response): void
    {
        $data = $response->json();
        $this->assertFalse($data['status']);
        $this->assertIsString($data['message']);
        $this->assertNull($data['data']);
        $this->assertNotNull($data['error']);
        $this->assertArrayHasKey('type', $data['error']);
        $this->assertArrayHasKey('detail', $data['error']);
        $this->assertArrayHasKey('traceId', $data['error']);
    }

    public function test_create_returns_success_envelope(): void
    {
        $response = $this->postJson($this->apiBase, [
            'title' => 'Test',
            'amount' => 100,
        ], $this->authHeaders());

        $response->assertStatus(201);
        $this->assertSuccessEnvelope($response);
        $this->assertArrayHasKey('id', $response->json('data'));
        $this->createdId = $response->json('data.id');
    }

    public function test_list_returns_paginated_envelope(): void
    {
        $response = $this->getJson("{$this->apiBase}?page=1&limit=10", $this->authHeaders());

        $response->assertStatus(200);
        $this->assertSuccessEnvelope($response);
        $response->assertJsonStructure([
            'data' => ['items', 'total', 'page', 'limit', 'totalPages']
        ]);
        $this->assertIsArray($response->json('data.items'));
    }

    public function test_delete_returns_204_empty(): void
    {
        $createRes = $this->postJson($this->apiBase, [
            'title' => 'ToDelete', 'amount' => 50,
        ], $this->authHeaders());
        $id = $createRes->json('data.id');

        $response = $this->deleteJson("{$this->apiBase}/{$id}", [], $this->authHeaders());
        $response->assertStatus(204);
        $response->assertNoContent();
    }

    public function test_validation_error_returns_error_envelope(): void
    {
        $response = $this->postJson($this->apiBase, [], $this->authHeaders());

        $response->assertStatus(422);
        $this->assertErrorEnvelope($response);
        $this->assertArrayHasKey('errors', $response->json('error'));
        $this->assertIsArray($response->json('error.errors'));
    }

    public function test_not_found_returns_error_envelope(): void
    {
        $response = $this->getJson(
            "{$this->apiBase}/00000000-0000-0000-0000-000000000000",
            $this->authHeaders()
        );

        $response->assertStatus(404);
        $this->assertErrorEnvelope($response);
    }
}
```

---

## Ruby on Rails (RSpec)

**File:** `spec/requests/api/v1/{resources}_contract_spec.rb`

```ruby
require 'rails_helper'

RSpec.describe "Api::V1::{Resources} Contract", type: :request do
  let(:api_base) { "/api/v1/{resources}" }
  let(:headers) { { "Content-Type" => "application/json" } }
  let(:auth_headers) { headers.merge(authenticated_header) } # project auth helper

  def expect_success_envelope(body)
    expect(body["status"]).to eq(true)
    expect(body["message"]).to be_a(String)
    expect(body["data"]).not_to be_nil
    expect(body["error"]).to be_nil
  end

  def expect_error_envelope(body)
    expect(body["status"]).to eq(false)
    expect(body["message"]).to be_a(String)
    expect(body["data"]).to be_nil
    expect(body["error"]).not_to be_nil
    expect(body["error"]).to have_key("type")
    expect(body["error"]).to have_key("detail")
    expect(body["error"]).to have_key("traceId")
  end

  describe "POST / — create" do
    it "returns success envelope with status: true" do
      post api_base, params: { {resource}: { title: "Test", amount: 100 } }.to_json, headers: auth_headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect_success_envelope(body)
      expect(body["data"]).to have_key("id")
    end
  end

  describe "GET / — list" do
    it "returns paginated envelope" do
      get "#{api_base}?page=1&limit=10", headers: auth_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect_success_envelope(body)
      expect(body["data"]).to have_key("items")
      expect(body["data"]["items"]).to be_an(Array)
      expect(body["data"]).to have_key("total")
      expect(body["data"]).to have_key("page")
      expect(body["data"]).to have_key("limit")
      expect(body["data"]).to have_key("totalPages")
    end
  end

  describe "DELETE /:id" do
    it "returns 204 with empty body" do
      post api_base, params: { {resource}: { title: "Del", amount: 50 } }.to_json, headers: auth_headers
      id = JSON.parse(response.body)["data"]["id"]

      delete "#{api_base}/#{id}", headers: auth_headers

      expect(response).to have_http_status(:no_content)
      expect(response.body).to be_empty
    end
  end

  describe "POST / — validation error" do
    it "returns error envelope with errors[]" do
      post api_base, params: { {resource}: {} }.to_json, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect_error_envelope(body)
      expect(body["error"]).to have_key("errors")
      expect(body["error"]["errors"]).to be_an(Array)
    end
  end

  describe "GET /:id — not found" do
    it "returns error envelope" do
      get "#{api_base}/00000000-0000-0000-0000-000000000000", headers: auth_headers

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect_error_envelope(body)
    end
  end
end
```

---

## What These Tests Guarantee

Every test suite verifies the **same 6 contract rules** regardless of framework:

| # | Rule | Success Check | Error Check |
|---|------|---------------|-------------|
| 1 | `status` is boolean | `status: true` | `status: false` |
| 2 | `message` is string | Present on all | Present on all |
| 3 | `data` is present | Not null on success | `null` on error |
| 4 | `error` is present | `null` on success | Object with `type`, `detail`, `traceId` |
| 5 | Pagination shape | `items[]`, `total`, `page`, `limit`, `totalPages` | N/A |
| 6 | Delete is 204 | Empty body | N/A |

If any of these tests fail, the generated code does not comply with the response contract.
