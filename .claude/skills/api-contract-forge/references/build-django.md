# Django REST Framework — Build Templates

> **Response contract:** All endpoints MUST conform to the envelope defined in `references/response-contract.md`.

Use these templates when the project detection (Step 0.1) identifies Django REST Framework. Adapt all placeholder tokens to the actual resource name. Use snake_case per Python/Django conventions.

Generate: Model, Serializer, ViewSet, URL config, Permissions. Generate only the operations the user requested.

---

## File 1: Model — `{app}/models.py`

```python
from django.db import models
import uuid

class {Resource}(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=[("draft", "Draft"), ("sent", "Sent"), ("paid", "Paid")],
        default="draft",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
```

---

## File 2: Serializer — `{app}/serializers.py`

```python
from rest_framework import serializers
from .models import {Resource}

class {Resource}Serializer(serializers.ModelSerializer):
    class Meta:
        model = {Resource}
        fields = ["id", "title", "amount", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

class Create{Resource}Serializer(serializers.ModelSerializer):
    """Separate serializer for creation — allows different validation rules."""
    class Meta:
        model = {Resource}
        fields = ["title", "amount", "status"]

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Amount must be non-negative.")
        return value
```

Using separate serializers for read vs. write operations gives you tighter control over which fields are accepted on input vs. returned on output. This prevents accidental field exposure.

---

## File 3: ViewSet — `{app}/views.py`

```python
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import {Resource}
from .serializers import {Resource}Serializer, Create{Resource}Serializer
from core.mixins import EnvelopeResponseMixin  # see File 6 below

class {Resource}ViewSet(EnvelopeResponseMixin, viewsets.ModelViewSet):
    queryset = {Resource}.objects.all()
    serializer_class = {Resource}Serializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["title"]
    ordering_fields = ["created_at", "amount"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return Create{Resource}Serializer
        return {Resource}Serializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
```

The `EnvelopeResponseMixin` (defined below in File 6) automatically wraps every response in the unified `{status, message, data, error}` envelope. Paginated list responses are handled by the custom pagination class (File 7).

---

## File 4: URLs — `{app}/urls.py`

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import {Resource}ViewSet

router = DefaultRouter()
router.register(r"{resources}", {Resource}ViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
```

Then register in the project's main `urls.py`:
```python
urlpatterns = [
    path("api/v1/", include("{app}.urls")),
]
```

---

## File 5: Migration

Run after creating the model:
```bash
python manage.py makemigrations {app}
python manage.py migrate
```

---

## File 6: Response Envelope Mixin — `core/mixins.py`

This mixin wraps every non-paginated response in the standard envelope. Place it in a shared `core` app.

```python
from rest_framework.response import Response


class EnvelopeResponseMixin:
    """
    Wraps all ViewSet responses in the unified API envelope:
      { "status": true, "message": "...", "data": { ... }, "error": null }

    Paginated responses are handled by StandardPagination (File 7) instead.
    Delete (204) is left as-is (empty body).
    """

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)

        # Skip wrapping for: non-2xx, 204 No Content, or already-paginated responses
        if (
            not (200 <= response.status_code < 300)
            or response.status_code == 204
            or getattr(response, "is_paginated", False)
        ):
            return response

        # Avoid double-wrapping if data already has the envelope
        if isinstance(response.data, dict) and "status" in response.data:
            return response

        action = getattr(self, "action", None)
        message_map = {
            "create": "{Resource} created",
            "retrieve": "{Resource} retrieved",
            "update": "{Resource} updated",
            "partial_update": "{Resource} updated",
            "list": "{Resources} retrieved",
        }
        message = message_map.get(action, "Success")

        response.data = {
            "status": True,
            "message": message,
            "data": response.data,
            "error": None,
        }
        return response
```

---

## File 7: Custom Pagination — `core/pagination.py`

DRF's default pagination returns `{count, next, previous, results}` which does not match the contract. Use this custom class instead.

```python
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
import math


class StandardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "limit"
    max_page_size = 100
    page_query_param = "page"

    def get_paginated_response(self, data):
        total = self.page.paginator.count
        page = self.page.number
        limit = self.get_page_size(self.request)
        total_pages = math.ceil(total / limit) if limit else 0

        response = Response({
            "status": True,
            "message": "Items retrieved",
            "data": {
                "items": data,
                "total": total,
                "page": page,
                "limit": limit,
                "totalPages": total_pages,
            },
            "error": None,
        })
        response.is_paginated = True  # tells EnvelopeResponseMixin to skip wrapping
        return response
```

---

## File 8: Custom Exception Handler — `core/exception_handler.py`

DRF's default error format (`{field: [errors]}`) does not match the contract. Register this handler to produce the standard error envelope.

```python
from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError
import uuid


def standard_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return response

    errors = []
    if isinstance(exc, ValidationError) and isinstance(response.data, dict):
        for field, messages in response.data.items():
            if isinstance(messages, list):
                for msg in messages:
                    errors.append({"field": field, "message": str(msg)})
            else:
                errors.append({"field": field, "message": str(messages)})
        detail = "One or more fields failed validation."
        message = "Validation Error"
    else:
        detail = str(response.data.get("detail", "An error occurred"))
        message = detail
        errors = []

    response.data = {
        "status": False,
        "message": message,
        "data": None,
        "error": {
            "type": "about:blank",
            "detail": detail,
            "traceId": str(uuid.uuid4()),
            "errors": errors,
        },
    }
    return response
```

---

## Pagination & Exception Handler (project-level `settings.py`)

Register the custom pagination class and exception handler:

```python
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardPagination",
    "PAGE_SIZE": 10,
    "EXCEPTION_HANDLER": "core.exception_handler.standard_exception_handler",
}
```
