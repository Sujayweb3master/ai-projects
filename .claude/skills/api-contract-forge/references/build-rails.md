# Ruby on Rails — Build Templates

> **Response contract:** All responses MUST follow the standard envelope defined in `references/response-contract.md`.

Use these templates when the project detection (Step 0.1) identifies Rails. Adapt all placeholder tokens to the actual resource name. Use snake_case per Ruby conventions.

Generate: Controller, Model, Serializer, Migration, Route, Request validation. Generate only the operations the user requested.

---

## File 1: Model — `app/models/{resource}.rb`

```ruby
class {Resource} < ApplicationRecord
  # Validations
  validates :title, presence: true, length: { maximum: 200 }
  validates :amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :status, inclusion: { in: %w[draft sent paid] }, allow_nil: true

  # Defaults
  attribute :status, :string, default: "draft"

  # Scopes
  scope :search, ->(query) { where("title ILIKE ?", "%#{query}%") if query.present? }
  scope :by_status, ->(status) { where(status: status) if status.present? }
  scope :sorted, ->(sort_by, order) {
    order(sort_by => order || :desc)
  }
end
```

---

## File 2: Serializer — `app/serializers/{resource}_serializer.rb`

Using `active_model_serializers` or `jsonapi-serializer` (detect from Gemfile):

```ruby
# With active_model_serializers
class {Resource}Serializer < ActiveModel::Serializer
  attributes :id, :title, :amount, :status, :createdAt, :updatedAt

  def createdAt
    object.created_at.iso8601
  end

  def updatedAt
    object.updated_at.iso8601
  end
end
```

If the project uses `jbuilder` instead:

```ruby
# app/views/{resources}/show.json.jbuilder
json.extract! @{resource}, :id, :title, :amount, :status
json.createdAt @{resource}.created_at.iso8601
json.updatedAt @{resource}.updated_at.iso8601
```

---

## File 3: Controller — `app/controllers/api/v1/{resources}_controller.rb`

```ruby
module Api
  module V1
    class {Resources}Controller < ApplicationController
      before_action :authenticate_user!
      before_action :set_{resource}, only: [:show, :update, :destroy]

      # GET /api/v1/{resources}
      def index
        {resources} = {Resource}.all
        {resources} = {resources}.search(params[:search])
        {resources} = {resources}.by_status(params[:status])
        {resources} = {resources}.sorted(
          params[:sort_by] || "created_at",
          params[:sort_order]
        )

        page = (params[:page] || 1).to_i
        limit = [[params[:limit]&.to_i || 10, 100].min, 1].max
        total = {resources}.count
        {resources} = {resources}.offset((page - 1) * limit).limit(limit)

        render json: {
          status: true,
          message: "Data retrieved",
          data: {
            items: ActiveModelSerializers::SerializableResource.new({resources}),
            total: total,
            page: page,
            limit: limit,
            totalPages: (total.to_f / limit).ceil
          },
          error: nil
        }
      end

      # POST /api/v1/{resources}
      def create
        {resource} = {Resource}.new({resource}_params)

        if {resource}.save
          render json: {
            status: true,
            message: "{Resource} created",
            data: {Resource}Serializer.new({resource}),
            error: nil
          }, status: :created
        else
          render json: error_response({resource}), status: :unprocessable_entity
        end
      end

      # GET /api/v1/{resources}/:id
      def show
        render json: {
          status: true,
          message: "{Resource} retrieved",
          data: {Resource}Serializer.new(@{resource}),
          error: nil
        }
      end

      # PUT /api/v1/{resources}/:id
      def update
        if @{resource}.update({resource}_params)
          render json: {
            status: true,
            message: "{Resource} updated",
            data: {Resource}Serializer.new(@{resource}),
            error: nil
          }
        else
          render json: error_response(@{resource}), status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/{resources}/:id
      def destroy
        @{resource}.destroy
        head :no_content
      end

      private

      def set_{resource}
        @{resource} = {Resource}.find(params[:id])
      end

      def {resource}_params
        params.require(:{resource}).permit(:title, :amount, :status)
      end

      def error_response(resource)
        {
          status: false,
          message: "Validation Failed",
          data: nil,
          error: {
            type: "validation_error",
            detail: "One or more fields failed validation.",
            traceId: request.headers["X-Trace-Id"] || SecureRandom.uuid,
            errors: resource.errors.map { |e| { field: e.attribute.to_s.camelize(:lower), message: e.full_message } }
          }
        }
      end
    end
  end
end
```

---

## File 4: Migration

```ruby
class Create{Resources} < ActiveRecord::Migration[7.1]
  def change
    create_table :{resources}, id: :uuid do |t|
      t.string :title, null: false, limit: 200
      t.decimal :amount, null: false, precision: 12, scale: 2
      t.string :status, default: "draft"
      t.timestamps
    end

    add_index :{resources}, :status
    add_index :{resources}, :created_at
  end
end
```

Run: `rails db:migrate`

---

## File 5: Routes — `config/routes.rb`

```ruby
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :{resources}, only: [:index, :show, :create, :update, :destroy]
    end
  end
end
```

If the user requested only specific operations, use the `only` option to limit which routes are generated.

---

## File 6: Error Handling — `app/controllers/application_controller.rb`

Add `rescue_from` blocks to `ApplicationController` so all API errors follow the standard contract:

```ruby
class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from StandardError, with: :internal_error

  private

  def not_found(exception)
    render json: {
      status: false,
      message: "Resource Not Found",
      data: nil,
      error: {
        type: "not_found",
        detail: exception.message,
        traceId: request.headers["X-Trace-Id"] || SecureRandom.uuid
      }
    }, status: :not_found
  end

  def internal_error(exception)
    render json: {
      status: false,
      message: "Internal Server Error",
      data: nil,
      error: {
        type: "server_error",
        detail: Rails.env.production? ? "An unexpected error occurred." : exception.message,
        traceId: request.headers["X-Trace-Id"] || SecureRandom.uuid
      }
    }, status: :internal_server_error
  end
end
```

This ensures all error responses — validation, not-found, and server errors — follow the unified envelope (`{ status: false, message, data: null, error: { type, detail, traceId, errors } }`). Validation errors are handled inline in the controller via the `error_response` helper.
