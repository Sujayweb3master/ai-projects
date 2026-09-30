# NestJS — Build Templates

> **Response contract:** All responses MUST conform to the unified envelope defined in [`references/response-contract.md`](./response-contract.md). Controller methods must wrap return values in the `{ status, message, data, error }` envelope — never return raw entities. See that file for the canonical single-item, list, delete, and error shapes.

Use these templates when the project detection (Step 0.1) identifies NestJS. Adapt all placeholder tokens to the actual resource name.

Generate: Module, Controller (with decorators), Service, DTOs (with class-validator), Entity, Swagger decorators. Generate only the operations the user requested.

---

## File 1: DTO — `src/{resource}/dto/create-{resource}.dto.ts`

```typescript
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Create{Resource}Dto {
  @ApiProperty({ description: 'Title', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Amount', minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ enum: ['draft', 'sent', 'paid'], default: 'draft' })
  @IsOptional()
  @IsEnum(['draft', 'sent', 'paid'])
  status?: string;
}
```

### Update DTO — `src/{resource}/dto/update-{resource}.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { Create{Resource}Dto } from './create-{resource}.dto';

export class Update{Resource}Dto extends PartialType(Create{Resource}Dto) {}
```

NestJS's `PartialType` makes all fields optional and copies Swagger metadata — this keeps create and update DTOs in sync automatically.

### Query DTO — `src/{resource}/dto/{resource}-query.dto.ts`

```typescript
import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class {Resource}QueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
```

---

## File 2: Controller — `src/{resource}/{resource}.controller.ts`

> **Important:** Every controller method wraps its return value in the unified response envelope (`{ status, message, data, error }`). Never return raw entities — this breaks the API contract.

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { {Resource}Service } from './{resource}.service';
import { Create{Resource}Dto } from './dto/create-{resource}.dto';
import { Update{Resource}Dto } from './dto/update-{resource}.dto';
import { {Resource}QueryDto } from './dto/{resource}-query.dto';

@ApiTags('{Resources}')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('{resources}')
export class {Resource}Controller {
  constructor(private readonly {resource}Service: {Resource}Service) {}

  @Post()
  @ApiOperation({ summary: 'Create a new {resource}' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '{Resource} created' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation error' })
  async create(@Body() dto: Create{Resource}Dto) {
    const result = await this.{resource}Service.create(dto);
    // Envelope: { status: true, message: "...", data: { ...entity }, error: null }
    return { status: true, message: '{Resource} created', data: result, error: null };
  }

  @Get()
  @ApiOperation({ summary: 'List {resources} with pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: '{Resources} retrieved' })
  async findAll(@Query() query: {Resource}QueryDto) {
    const result = await this.{resource}Service.findAll(query);
    // Envelope: { status: true, message: "...", data: { items, total, page, limit, totalPages }, error: null }
    return { status: true, message: '{Resources} retrieved', data: result, error: null };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single {resource}' })
  @ApiResponse({ status: HttpStatus.OK, description: '{Resource} found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '{Resource} not found' })
  async findOne(@Param('id') id: string) {
    const result = await this.{resource}Service.findOne(id);
    return { status: true, message: '{Resource} retrieved', data: result, error: null };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a {resource}' })
  async update(@Param('id') id: string, @Body() dto: Update{Resource}Dto) {
    const result = await this.{resource}Service.update(id, dto);
    return { status: true, message: '{Resource} updated', data: result, error: null };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a {resource}' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '{Resource} deleted' })
  async remove(@Param('id') id: string) {
    await this.{resource}Service.remove(id);
    // 204 No Content — empty body, no JSON envelope
  }
}
```

### Error handling — Exception Filter

To produce the unified error envelope (`{ status: false, message, data: null, error: { type, detail, traceId, errors } }`), register a global exception filter. This ensures all errors — including validation failures, 404s, and unhandled exceptions — conform to the response contract.

```typescript
// src/common/filters/api-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const httpStatus = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const detail = typeof exceptionResponse === 'string'
      ? exceptionResponse
      : (exceptionResponse as any).message || 'An error occurred';

    const errors = Array.isArray(detail) ? detail : [];

    response.status(httpStatus).json({
      status: false,
      message: HttpStatus[httpStatus] || 'Error',
      data: null,
      error: {
        type: `https://httpstatuses.com/${httpStatus}`,
        detail: Array.isArray(detail) ? 'Validation failed' : detail,
        traceId: uuidv4(),
        errors,
      },
    });
  }
}
```

Register globally in `main.ts`:

```typescript
app.useGlobalFilters(new ApiExceptionFilter());
```

> **Note:** The exception filter is required for contract compliance. Without it, NestJS's default error format (`{ statusCode, message, error }`) does not match the unified envelope (`{ status, message, data, error }`).

---

## File 3: Service — `src/{resource}/{resource}.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { {Resource} } from './{resource}.entity';
import { Create{Resource}Dto } from './dto/create-{resource}.dto';
import { Update{Resource}Dto } from './dto/update-{resource}.dto';
import { {Resource}QueryDto } from './dto/{resource}-query.dto';

@Injectable()
export class {Resource}Service {
  constructor(
    @InjectRepository({Resource})
    private readonly repo: Repository<{Resource}>,
  ) {}

  async create(dto: Create{Resource}Dto): Promise<{Resource}> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findAll(query: {Resource}QueryDto) {
    const { page = 1, limit = 10, search } = query;
    const qb = this.repo.createQueryBuilder('{resource}');

    if (search) {
      qb.where('{resource}.title ILIKE :search', { search: `%${search}%` });
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('{resource}.createdAt', 'DESC')
      .getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<{Resource}> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('{Resource} not found');
    return item;
  }

  async update(id: string, dto: Update{Resource}Dto): Promise<{Resource}> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
```

---

## File 4: Module — `src/{resource}/{resource}.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { {Resource} } from './{resource}.entity';
import { {Resource}Controller } from './{resource}.controller';
import { {Resource}Service } from './{resource}.service';

@Module({
  imports: [TypeOrmModule.forFeature([{Resource}])],
  controllers: [{Resource}Controller],
  providers: [{Resource}Service],
  exports: [{Resource}Service],
})
export class {Resource}Module {}
```

Follow NestJS conventions: `@Controller`, `@Get`, `@Post`, `@ApiTags`, `@ApiBearerAuth`, `@ApiResponse`. If the project uses Prisma instead of TypeORM, adapt the service to use `PrismaService` injection. All controller methods must wrap results in the unified response envelope (`{ status, message, data, error }`) — see [`references/response-contract.md`](./response-contract.md).
