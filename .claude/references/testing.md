# Testing Strategies

## Test Pyramid
- 70% Unit Tests (fast, isolated)
- 20% Integration Tests (API + DB)
- 10% E2E Tests (critical flows)

## Unit Testing
```javascript
it('should create user with valid data', async () => {
  const result = await createUser({ email: 'test@example.com' })
  expect(result).toHaveProperty('id')
})
```

## Integration Testing
```javascript
it('should return 201 on user creation', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ email: 'test@example.com' })
    .expect(201)
})
```

## E2E Testing (Playwright)
```javascript
test('should complete registration', async ({ page }) => {
  await page.goto('/register')
  await page.fill('input[name="email"]', 'new@example.com')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
```

## Coverage Targets
- Business Logic: 100%
- Services: >90%
- Overall: >80%
