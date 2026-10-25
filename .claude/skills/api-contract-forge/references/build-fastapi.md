# FastAPI + Python — Build Templates

> **Response contract:** All endpoints MUST conform to the envelope defined in `references/response-contract.md`.

Use these templates when the project detection (Step 0.1) identifies FastAPI. Adapt all placeholder tokens to the actual resource name. Use snake_case for Python conventions.

Generate: Router, Pydantic models, Service, SQLAlchemy model (if detected). Generate only the operations the user requested.

---

## File 1: Pydantic Schemas — `schemas/{resource}.py`

```python
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime

class {Resource}Status(str, Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"

class Create{Resource}(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., ge=0)
    status: {Resource}Status = {Resource}Status.draft

class Update{Resource}(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    amount: Optional[float] = Field(None, ge=0)
    status: Optional[{Resource}Status] = None

class {Resource}Response(BaseModel):
    id: str
    title: str
    amount: float
    status: {Resource}Status
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class {Resource}QueryParams(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(10, ge=1, le=100)
    search: Optional[str] = None
    status: Optional[{Resource}Status] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"

# --- Standard response envelopes (place in core/schemas.py or similar) ---

from typing import TypeVar, Generic, List
T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    status: bool
    message: str
    data: Optional[T] = None
    error: Optional[dict] = None

class PaginatedData(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    totalPages: int

class PaginatedResponse(BaseModel, Generic[T]):
    status: bool = True
    message: str
    data: PaginatedData[T]
    error: Optional[dict] = None
```

Pydantic v2 is the current standard. Use `model_config` instead of the old `class Config`. The `from_attributes=True` setting lets you pass ORM objects directly to response models — this avoids manual dict conversion.

---

## File 2: Router — `routes/{resource}.py`

```python
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..schemas.{resource} import (
    Create{Resource}, Update{Resource}, {Resource}Response, {Resource}QueryParams
)
from ..services.{resource}_service import {Resource}Service
from ..auth import get_current_user

router = APIRouter(prefix="/{resources}", tags=["{Resources}"])

@router.post(
    "/",
    response_model=ApiResponse[{Resource}Response],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new {resource}",
)
async def create_{resource}(
    data: Create{Resource},
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = {Resource}Service(db)
    result = service.create(data, current_user)
    return {"status": True, "message": "{Resource} created", "data": result, "error": None}

@router.get(
    "/",
    response_model=PaginatedResponse[{Resource}Response],
    summary="List {resources} with pagination",
)
async def list_{resources}(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = {Resource}Service(db)
    items, total = service.find_all(page, limit, search, status_filter)
    return {
        "status": True,
        "message": "{Resources} retrieved",
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": -(-total // limit),
        },
        "error": None,
    }

@router.get("/{id}", response_model=ApiResponse[{Resource}Response])
async def get_{resource}(id: str, db: Session = Depends(get_db)):
    service = {Resource}Service(db)
    result = service.find_by_id(id)
    if not result:
        raise HTTPException(status_code=404, detail="{Resource} not found")
    return {"status": True, "message": "{Resource} retrieved", "data": result, "error": None}

@router.put("/{id}", response_model=ApiResponse[{Resource}Response])
async def update_{resource}(id: str, data: Update{Resource}, db: Session = Depends(get_db)):
    service = {Resource}Service(db)
    result = service.update(id, data)
    return {"status": True, "message": "{Resource} updated", "data": result, "error": None}

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_{resource}(id: str, db: Session = Depends(get_db)):
    service = {Resource}Service(db)
    service.delete(id)
```

---

## File 3: Service — `services/{resource}_service.py`

```python
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models.{resource} import {Resource}Model
from ..schemas.{resource} import Create{Resource}, Update{Resource}

class {Resource}Service:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: Create{Resource}, user) -> {Resource}Model:
        item = {Resource}Model(**data.model_dump())
        item.created_by = user.id
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def find_all(self, page: int, limit: int, search: str = None, status: str = None):
        query = self.db.query({Resource}Model)
        if search:
            query = query.filter(
                or_({Resource}Model.title.ilike(f"%{search}%"))
            )
        if status:
            query = query.filter({Resource}Model.status == status)

        total = query.count()
        items = query.offset((page - 1) * limit).limit(limit).all()
        return items, total

    def find_by_id(self, id: str) -> {Resource}Model:
        return self.db.query({Resource}Model).filter({Resource}Model.id == id).first()

    def update(self, id: str, data: Update{Resource}) -> {Resource}Model:
        item = self.find_by_id(id)
        if not item:
            raise ValueError("{Resource} not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete(self, id: str):
        item = self.find_by_id(id)
        if not item:
            raise ValueError("{Resource} not found")
        self.db.delete(item)
        self.db.commit()
```

---

## File 4: SQLAlchemy Model (if detected) — `models/{resource}.py`

```python
from sqlalchemy import Column, String, Float, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from ..database import Base

class {Resource}Model(Base):
    __tablename__ = "{resources}"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(Enum("draft", "sent", "paid", name="{resource}_status"), default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

If the project uses Tortoise ORM or SQLModel instead of SQLAlchemy, adapt accordingly. The key principle is the same: keep models close to the DB, schemas close to the API boundary.

---

## Custom Exception Handler (project-level)

Register this in `main.py` so that all errors conform to the standard error contract instead of FastAPI's default `{"detail": "..."}`:

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
import uuid

app = FastAPI()

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": False,
            "message": exc.detail if isinstance(exc.detail, str) else "Error",
            "data": None,
            "error": {
                "type": "about:blank",
                "detail": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
                "traceId": str(uuid.uuid4()),
            },
        },
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "status": False,
            "message": "Validation Error",
            "data": None,
            "error": {
                "type": "about:blank",
                "detail": "One or more fields failed validation.",
                "traceId": str(uuid.uuid4()),
                "errors": errors,
            },
        },
    )
```
