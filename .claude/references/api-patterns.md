# API Design Patterns

## RESTful Best Practices

### Endpoint Naming
- Use nouns, not verbs: `/users` not `/getUsers`
- Plural for collections: `/orders`, `/products`
- Nested resources: `/users/:id/orders`
- Versioning: `/v1/users`, `/v2/users`

### HTTP Methods
- GET: Retrieve resource(s)
- POST: Create new resource
- PUT: Full update (replace)
- PATCH: Partial update
- DELETE: Remove resource

### Status Codes
- 200: Success
- 201: Created
- 400: Bad Request (validation failed)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized)
- 404: Not Found
- 409: Conflict (duplicate resource)
- 500: Internal Server Error

### Response Format
```json
{
  "data": {...},
  "meta": {
    "timestamp": "2025-11-01T12:00:00Z",
    "version": "1.0"
  },
  "errors": []
}
```

### Error Format
```json
{
  "errors": [{
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "field": "email"
  }]
}
```

## Rate Limiting
- Header: `X-RateLimit-Limit: 1000`
- Header: `X-RateLimit-Remaining: 999`
- Header: `X-RateLimit-Reset: 1635724800`
- Status: 429 Too Many Requests

## Pagination
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## Authentication Headers
```
Authorization: Bearer <jwt_token>
X-API-Key: <api_key>
```

## Idempotency
- Use idempotency keys for POST/PATCH to prevent duplicates
- Header: `Idempotency-Key: <uuid>`

## CORS Configuration
```javascript
{
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

## API Versioning Strategies
1. **URL versioning** (recommended): `/v1/users`, `/v2/users`
2. **Header versioning**: `Accept: application/vnd.api.v1+json`
3. **Query parameter**: `/users?version=1`

## Request Validation
- Validate all inputs server-side
- Use schemas (Zod, Joi, Yup)
- Return detailed validation errors
- Never trust client-side validation

## Response Caching
```
Cache-Control: public, max-age=3600
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Wed, 21 Oct 2025 07:28:00 GMT
```
