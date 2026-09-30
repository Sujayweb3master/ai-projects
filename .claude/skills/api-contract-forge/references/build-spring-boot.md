> **Response contract:** see [`references/response-contract.md`](response-contract.md) for the canonical envelope, pagination, and error shapes.

# Spring Boot (Kotlin / Java) — Build Templates

Use these templates when the project detection (Step 0.1) identifies Spring Boot. The examples below use Kotlin — adapt to Java if detected. Adapt all placeholder tokens to the actual resource name.

Generate: Controller, DTO (with Jakarta validation), Service, Repository, Entity. Generate only the operations the user requested.

---

## File 1: DTOs — `dto/{Resource}Dtos.kt`

```kotlin
import jakarta.validation.constraints.*

data class Create{Resource}Dto(
    @field:NotBlank
    @field:Size(min = 1, max = 200)
    val title: String,

    @field:Min(0)
    val amount: BigDecimal,

    val status: {Resource}Status = {Resource}Status.DRAFT
)

data class Update{Resource}Dto(
    @field:Size(min = 1, max = 200)
    val title: String? = null,

    @field:Min(0)
    val amount: BigDecimal? = null,

    val status: {Resource}Status? = null
)

data class {Resource}QueryDto(
    @field:Min(1)
    val page: Int = 1,

    @field:Min(1) @field:Max(100)
    val limit: Int = 10,

    val search: String? = null,
    val status: {Resource}Status? = null,
    val sortBy: String = "createdAt",
    val sortOrder: String = "desc"
)

data class {Resource}Response(
    val id: String,
    val title: String,
    val amount: BigDecimal,
    val status: {Resource}Status,
    val createdAt: Instant,
    val updatedAt: Instant
)

enum class {Resource}Status {
    DRAFT, SENT, PAID
}
```

---

## File 1b: Response Wrappers — `dto/ResponseWrappers.kt`

```kotlin
/** Unified API envelope — every response (except 204) uses this. */
data class ApiResponse<T>(
    val status: Boolean,
    val message: String,
    val data: T?,
    val error: ErrorDetail? = null
) {
    companion object {
        fun <T> success(data: T, message: String = "Success") =
            ApiResponse(status = true, message = message, data = data, error = null)

        fun <T> created(data: T, message: String = "Created") =
            ApiResponse(status = true, message = message, data = data, error = null)
    }
}

/** Paginated list — always nested inside ApiResponse.data */
data class PaginatedResponse<T>(
    val items: List<T>,
    val total: Long,
    val page: Int,
    val limit: Int,
    val totalPages: Int
)

/** Error detail — nested inside ApiResponse.error on failure */
data class ErrorDetail(
    val type: String,
    val detail: String,
    val traceId: String? = null,
    val errors: List<String> = emptyList()
)

/** Helper to create error responses */
fun errorResponse(message: String, errorDetail: ErrorDetail): ApiResponse<Nothing> =
    ApiResponse(status = false, message = message, data = null, error = errorDetail)
```

---

## File 2: Controller — `controller/{Resource}Controller.kt`

```kotlin
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid

@RestController
@RequestMapping("/api/v1/{resources}")
class {Resource}Controller(private val service: {Resource}Service) {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody dto: Create{Resource}Dto): ApiResponse<{Resource}Response> {
        return ApiResponse.created(service.create(dto), "{Resource} created")
    }

    @GetMapping
    fun findAll(@Valid query: {Resource}QueryDto): ApiResponse<PaginatedResponse<{Resource}Response>> {
        return ApiResponse.success(service.findAll(query), "Data retrieved")
    }

    @GetMapping("/{id}")
    fun findById(@PathVariable id: String): ApiResponse<{Resource}Response> {
        return ApiResponse.success(service.findById(id))
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: String,
        @Valid @RequestBody dto: Update{Resource}Dto
    ): ApiResponse<{Resource}Response> {
        return ApiResponse.success(service.update(id, dto), "{Resource} updated")
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: String) {
        service.delete(id)
    }
}
```

---

## File 3: Service — `service/{Resource}Service.kt`

```kotlin
import org.springframework.stereotype.Service
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort

@Service
class {Resource}Service(private val repository: {Resource}Repository) {

    fun create(dto: Create{Resource}Dto): {Resource}Response {
        val entity = {Resource}Entity(
            title = dto.title,
            amount = dto.amount,
            status = dto.status
        )
        return repository.save(entity).toResponse()
    }

    fun findAll(query: {Resource}QueryDto): PaginatedResponse<{Resource}Response> {
        val sort = Sort.by(
            if (query.sortOrder == "asc") Sort.Direction.ASC else Sort.Direction.DESC,
            query.sortBy
        )
        val pageable = PageRequest.of(query.page - 1, query.limit, sort)
        val page = if (query.search != null) {
            repository.findByTitleContainingIgnoreCase(query.search, pageable)
        } else {
            repository.findAll(pageable)
        }
        return PaginatedResponse(
            items = page.content.map { it.toResponse() },
            total = page.totalElements,
            page = query.page,
            limit = query.limit,
            totalPages = page.totalPages
        )
    }

    fun findById(id: String): {Resource}Response {
        return repository.findById(id)
            .orElseThrow { ResourceNotFoundException("{Resource} not found") }
            .toResponse()
    }

    fun update(id: String, dto: Update{Resource}Dto): {Resource}Response {
        val entity = repository.findById(id)
            .orElseThrow { ResourceNotFoundException("{Resource} not found") }
        dto.title?.let { entity.title = it }
        dto.amount?.let { entity.amount = it }
        dto.status?.let { entity.status = it }
        return repository.save(entity).toResponse()
    }

    fun delete(id: String) {
        if (!repository.existsById(id)) throw ResourceNotFoundException("{Resource} not found")
        repository.deleteById(id)
    }
}
```

---

## File 4: Entity — `entity/{Resource}Entity.kt`

```kotlin
import jakarta.persistence.*
import java.math.BigDecimal
import java.time.Instant

@Entity
@Table(name = "{resources}")
class {Resource}Entity(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: String? = null,

    @Column(nullable = false, length = 200)
    var title: String,

    @Column(nullable = false)
    var amount: BigDecimal,

    @Enumerated(EnumType.STRING)
    var status: {Resource}Status = {Resource}Status.DRAFT,

    @Column(updatable = false)
    var createdAt: Instant = Instant.now(),

    var updatedAt: Instant = Instant.now()
) {
    fun toResponse() = {Resource}Response(
        id = id!!, title = title, amount = amount,
        status = status, createdAt = createdAt, updatedAt = updatedAt
    )

    @PreUpdate
    fun onUpdate() { updatedAt = Instant.now() }
}
```

---

## File 5: Repository — `repository/{Resource}Repository.kt`

```kotlin
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface {Resource}Repository : JpaRepository<{Resource}Entity, String> {
    fun findByTitleContainingIgnoreCase(title: String, pageable: Pageable): Page<{Resource}Entity>
}
```

---

## File 6: Global Exception Handler — `exception/GlobalExceptionHandler.kt`

```kotlin
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.context.request.WebRequest
import java.util.UUID

class ResourceNotFoundException(message: String) : RuntimeException(message)

@ControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException::class)
    fun handleNotFound(ex: ResourceNotFoundException, request: WebRequest): ResponseEntity<ApiResponse<Nothing>> {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
            errorResponse("Resource Not Found", ErrorDetail(
                type = "https://httpstatuses.com/404",
                detail = ex.message ?: "Resource not found",
                traceId = UUID.randomUUID().toString()
            ))
        )
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException, request: WebRequest): ResponseEntity<ApiResponse<Nothing>> {
        val fieldErrors = ex.bindingResult.fieldErrors.map { "${it.field}: ${it.defaultMessage}" }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
            errorResponse("Validation Error", ErrorDetail(
                type = "https://httpstatuses.com/400",
                detail = "Validation failed",
                traceId = UUID.randomUUID().toString(),
                errors = fieldErrors
            ))
        )
    }

    @ExceptionHandler(Exception::class)
    fun handleGeneric(ex: Exception, request: WebRequest): ResponseEntity<ApiResponse<Nothing>> {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            errorResponse("Internal Server Error", ErrorDetail(
                type = "https://httpstatuses.com/500",
                detail = ex.message ?: "An unexpected error occurred",
                traceId = UUID.randomUUID().toString()
            ))
        )
    }
}
```

---

If using Java instead of Kotlin, convert `data class` to regular classes with getters/setters or use Lombok `@Data`.
