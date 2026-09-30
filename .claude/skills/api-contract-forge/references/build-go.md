> **Response contract:** see [`references/response-contract.md`](response-contract.md) for the canonical envelope, pagination, and error shapes.

# Go (Gin / Echo / Chi) — Build Templates

Use these templates when the project detection (Step 0.1) identifies a Go framework. Adapt all placeholder tokens to the actual resource name. The examples below use Gin — adapt to Echo or Chi if detected.

Generate: Handler, Model structs with json tags, Validation (go-playground/validator), OpenAPI comments. Generate only the operations the user requested.

---

## File 1: Model / Request Structs — `models/{resource}.go`

```go
package models

import "time"

// Create{Resource}Request — validation via go-playground/validator
type Create{Resource}Request struct {
    Title  string  `json:"title" binding:"required,min=1,max=200"`
    Amount float64 `json:"amount" binding:"required,min=0"`
    Status string  `json:"status" binding:"omitempty,oneof=draft sent paid"`
}

// Update{Resource}Request — all optional for partial updates
type Update{Resource}Request struct {
    Title  *string  `json:"title,omitempty" binding:"omitempty,min=1,max=200"`
    Amount *float64 `json:"amount,omitempty" binding:"omitempty,min=0"`
    Status *string  `json:"status,omitempty" binding:"omitempty,oneof=draft sent paid"`
}

// {Resource}Response — the shape returned to clients
type {Resource}Response struct {
    ID        string    `json:"id"`
    Title     string    `json:"title"`
    Amount    float64   `json:"amount"`
    Status    string    `json:"status"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}

// {Resource}QueryParams — list/filter parameters
type {Resource}QueryParams struct {
    Page     int    `form:"page,default=1" binding:"min=1"`
    Limit    int    `form:"limit,default=10" binding:"min=1,max=100"`
    Search   string `form:"search"`
    Status   string `form:"status" binding:"omitempty,oneof=draft sent paid"`
    SortBy   string `form:"sortBy,default=created_at"`
    SortOrder string `form:"sortOrder,default=desc" binding:"oneof=asc desc"`
}

// PaginatedResponse — generic wrapper
type PaginatedResponse[T any] struct {
    Items      []T `json:"items"`
    Total      int `json:"total"`
    Page       int `json:"page"`
    Limit      int `json:"limit"`
    TotalPages int `json:"totalPages"`
}

// ApiResponse — unified envelope
type ApiResponse[T any] struct {
    Status  bool        `json:"status"`
    Message string      `json:"message"`
    Data    T           `json:"data"`
    Error   interface{} `json:"error"`
}

// ErrorDetail — nested inside ApiResponse.Error on failure
type ErrorDetail struct {
    Type    string   `json:"type"`
    Detail  string   `json:"detail"`
    TraceID string   `json:"traceId,omitempty"`
    Errors  []string `json:"errors,omitempty"`
}
```

Using pointer types (`*string`, `*float64`) for update requests lets you distinguish "field not sent" from "field sent as zero value" — important for PATCH semantics in Go.

---

## File 2: Handler — `handlers/{resource}.go`

```go
package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "yourproject/models"
    "yourproject/services"
)

type {Resource}Handler struct {
    service *services.{Resource}Service
}

func New{Resource}Handler(service *services.{Resource}Service) *{Resource}Handler {
    return &{Resource}Handler{service: service}
}

// @Summary Create a new {resource}
// @Tags {Resources}
// @Accept json
// @Produce json
// @Param body body models.Create{Resource}Request true "Create {resource}"
// @Success 201 {object} models.ApiResponse[models.{Resource}Response]
// @Failure 400,500 {object} models.ErrorResponse
// @Router /{resources} [post]
func (h *{Resource}Handler) Create(c *gin.Context) {
    var req models.Create{Resource}Request
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, models.ApiResponse[interface{}]{
            Status:  false,
            Message: "Bad Request",
            Data:    nil,
            Error: models.ErrorDetail{
                Type:   "https://httpstatuses.com/400",
                Detail: err.Error(),
            },
        })
        return
    }

    result, err := h.service.Create(&req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, models.ApiResponse[interface{}]{
            Status:  false,
            Message: "Internal Server Error",
            Data:    nil,
            Error: models.ErrorDetail{
                Type:   "https://httpstatuses.com/500",
                Detail: err.Error(),
            },
        })
        return
    }

    c.JSON(http.StatusCreated, models.ApiResponse[models.{Resource}Response]{
        Status:  true,
        Message: "{Resource} created",
        Data:    *result,
        Error:   nil,
    })
}

// @Summary List {resources}
// @Tags {Resources}
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param search query string false "Search term"
// @Success 200 {object} models.ApiResponse[models.PaginatedResponse[models.{Resource}Response]]
// @Router /{resources} [get]
func (h *{Resource}Handler) List(c *gin.Context) {
    var params models.{Resource}QueryParams
    if err := c.ShouldBindQuery(&params); err != nil {
        c.JSON(http.StatusBadRequest, models.ApiResponse[interface{}]{
            Status:  false,
            Message: "Bad Request",
            Data:    nil,
            Error: models.ErrorDetail{
                Type:   "https://httpstatuses.com/400",
                Detail: err.Error(),
            },
        })
        return
    }

    items, total, err := h.service.FindAll(&params)
    if err != nil {
        c.JSON(http.StatusInternalServerError, models.ApiResponse[interface{}]{
            Status:  false,
            Message: "Internal Server Error",
            Data:    nil,
            Error: models.ErrorDetail{
                Type:   "https://httpstatuses.com/500",
                Detail: err.Error(),
            },
        })
        return
    }

    totalPages := (total + params.Limit - 1) / params.Limit
    c.JSON(http.StatusOK, models.ApiResponse[models.PaginatedResponse[models.{Resource}Response]]{
        Status:  true,
        Message: "Data retrieved",
        Data: models.PaginatedResponse[models.{Resource}Response]{
            Items: items, Total: total, Page: params.Page,
            Limit: params.Limit, TotalPages: totalPages,
        },
        Error: nil,
    })
}

// GetByID — same pattern, wrap in ApiResponse with Status: true, Error: nil
// Update  — same pattern, wrap in ApiResponse with Status: true, Error: nil
// Delete  — returns 204 No Content with empty body:
//   c.Status(http.StatusNoContent)
```

---

## File 3: Routes — `routes/{resource}.go`

```go
func Register{Resource}Routes(r *gin.RouterGroup, handler *handlers.{Resource}Handler) {
    group := r.Group("/{resources}")
    group.Use(AuthMiddleware()) // if auth detected

    group.POST("/", handler.Create)
    group.GET("/", handler.List)
    group.GET("/:id", handler.GetByID)
    group.PUT("/:id", handler.Update)
    group.DELETE("/:id", handler.Delete)
}
```

Register in `main.go`:
```go
api := r.Group("/api/v1")
handlers.Register{Resource}Routes(api, {resource}Handler)
```

---

## Service layer

Follow the same pattern as other frameworks: keep DB queries in the service, return structured errors. If using GORM, use `gorm.Model` for base fields. If using sqlx, write raw queries.
