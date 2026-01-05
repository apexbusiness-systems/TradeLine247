# Performance Optimization

## Frontend Performance

### Code Splitting
```javascript
// Route-based splitting
const Dashboard = lazy(() => import('./Dashboard'))
const Settings = lazy(() => import('./Settings'))

// Component-based splitting
const HeavyChart = lazy(() => import('./HeavyChart'))
```

### Bundle Optimization
- Tree shaking: Remove unused code
- Minification: Terser for production
- Compression: gzip or brotli
- Target bundle size: <250KB initial

### Image Optimization
```html
<!-- Responsive images -->
<img srcset="image-320.webp 320w,
             image-640.webp 640w,
             image-1280.webp 1280w"
     sizes="(max-width: 640px) 100vw, 50vw"
     loading="lazy"
     alt="Description">

<!-- WebP with fallback -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>
```

### Lazy Loading
```javascript
// Images
<img loading="lazy" src="image.jpg" />

// Components
const Modal = lazy(() => import('./Modal'))

// Routes
{
  path: '/dashboard',
  component: lazy(() => import('./Dashboard'))
}
```

### Caching Strategies
```javascript
// Service Worker caching
workbox.routing.registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'images',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
)
```

### Virtual Scrolling
```javascript
// For large lists (1000+ items)
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={10000}
  itemSize={50}
  width="100%"
>
  {Row}
</FixedSizeList>
```

### Debouncing and Throttling
```javascript
// Debounce for search inputs
const debouncedSearch = debounce((query) => {
  fetchResults(query)
}, 300)

// Throttle for scroll events
const throttledScroll = throttle(() => {
  handleScroll()
}, 100)
```

## Backend Performance

### Database Optimization

#### Indexing Strategy
```sql
-- Single column index
CREATE INDEX idx_email ON users(email);

-- Composite index (order matters!)
CREATE INDEX idx_user_orders ON orders(user_id, created_at DESC);

-- Covering index (includes all queried columns)
CREATE INDEX idx_user_search ON users(email, first_name, last_name);

-- Partial index (filtered)
CREATE INDEX idx_active_users ON users(id) WHERE active = true;
```

#### Query Optimization
```sql
-- ❌ N+1 Query Problem
SELECT * FROM orders; -- 1 query
-- Then for each order:
SELECT * FROM users WHERE id = order.user_id; -- N queries

-- ✅ Use JOIN instead
SELECT orders.*, users.*
FROM orders
JOIN users ON orders.user_id = users.id;

-- ✅ Or use IN clause
SELECT * FROM users WHERE id IN (1, 2, 3, ...);
```

#### Connection Pooling
```javascript
// PostgreSQL example
const pool = new Pool({
  host: 'localhost',
  database: 'mydb',
  max: 20,              // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})
```

#### Query Analysis
```sql
-- Analyze query execution plan
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 123
AND created_at > '2025-01-01';
```

### Caching Layers

#### Redis Caching
```javascript
// Cache hot data (frequently accessed)
const getUser = async (userId) => {
  // Check cache first
  const cached = await redis.get(`user:${userId}`)
  if (cached) return JSON.parse(cached)

  // Fetch from database
  const user = await db.users.findById(userId)

  // Cache for 5 minutes
  await redis.setex(`user:${userId}`, 300, JSON.stringify(user))

  return user
}
```

#### Cache Invalidation
```javascript
// Invalidate on update
const updateUser = async (userId, data) => {
  await db.users.update(userId, data)
  await redis.del(`user:${userId}`) // Clear cache
}

// Cache with tags for bulk invalidation
await redis.sadd('user:tags', userId)
await redis.setex(`user:${userId}`, 300, JSON.stringify(user))
```

#### HTTP Caching
```javascript
// Cache-Control headers
res.set({
  'Cache-Control': 'public, max-age=3600',        // 1 hour
  'ETag': generateETag(data),
  'Last-Modified': new Date(data.updatedAt).toUTCString()
})

// For dynamic content that changes frequently
res.set('Cache-Control', 'private, no-cache, must-revalidate')
```

### API Optimization

#### Response Time Targets
- p50 (median): <100ms
- p95: <300ms
- p99: <500ms
- p99.9: <1000ms

#### Pagination
```javascript
// Cursor-based pagination (better for large datasets)
GET /api/users?cursor=eyJpZCI6MTAwfQ&limit=20

// Offset pagination (simpler, but slower for large offsets)
GET /api/users?page=2&limit=20
```

#### Response Compression
```javascript
const compression = require('compression')

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  },
  level: 6 // Balance between speed and compression
}))
```

#### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit')

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
})

app.use('/api/', limiter)
```

### Async Processing

#### Background Jobs
```javascript
// Use queues for heavy operations
const queue = new Bull('email-queue')

// Add job
await queue.add('send-email', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Thanks for signing up!'
})

// Process job
queue.process('send-email', async (job) => {
  await sendEmail(job.data)
})
```

#### Worker Threads
```javascript
// For CPU-intensive tasks
const { Worker } = require('worker_threads')

const worker = new Worker('./heavy-computation.js', {
  workerData: { input: data }
})

worker.on('message', (result) => {
  console.log('Result:', result)
})
```

## Performance Monitoring

### Key Metrics

#### Core Web Vitals
- **LCP** (Largest Contentful Paint): <2.5s
- **FID** (First Input Delay): <100ms
- **CLS** (Cumulative Layout Shift): <0.1

#### Server Metrics
- Response time (p50, p95, p99)
- Request rate (requests/second)
- Error rate (percentage)
- CPU usage (percentage)
- Memory usage (percentage)
- Database query time

### Monitoring Tools

#### APM (Application Performance Monitoring)
- New Relic
- DataDog
- Dynatrace
- AppDynamics

#### Logging and Tracing
```javascript
// Structured logging
logger.info('User login', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
  duration: responseTime
})

// Distributed tracing
const span = tracer.startSpan('database.query')
span.setTag('query', 'SELECT * FROM users')
// ... execute query
span.finish()
```

#### Real User Monitoring (RUM)
```javascript
// Track real user performance
window.addEventListener('load', () => {
  const perfData = window.performance.timing
  const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart

  analytics.track('page_load', {
    duration: pageLoadTime,
    url: window.location.href
  })
})
```

## Performance Testing

### Load Testing
```javascript
// Artillery example
const config = {
  target: 'https://api.example.com',
  phases: [
    { duration: 60, arrivalRate: 10 },   // Ramp up
    { duration: 300, arrivalRate: 50 },  // Sustained load
    { duration: 60, arrivalRate: 100 }   // Peak load
  ]
}
```

### Stress Testing
- Test beyond normal capacity
- Identify breaking point
- Measure recovery time
- Validate auto-scaling

### Benchmarking
```javascript
// Simple benchmark
const start = Date.now()
await performOperation()
const duration = Date.now() - start
console.log(`Operation took ${duration}ms`)

// Advanced benchmarking with statistics
const results = []
for (let i = 0; i < 1000; i++) {
  const start = performance.now()
  await operation()
  results.push(performance.now() - start)
}

console.log({
  mean: results.reduce((a, b) => a + b) / results.length,
  p50: percentile(results, 0.5),
  p95: percentile(results, 0.95),
  p99: percentile(results, 0.99)
})
```

## Quick Wins Checklist

### Frontend
- ✅ Enable compression (gzip/brotli)
- ✅ Optimize images (WebP, responsive)
- ✅ Implement lazy loading
- ✅ Code splitting for routes
- ✅ Use CDN for static assets
- ✅ Minimize third-party scripts
- ✅ Implement service worker caching

### Backend
- ✅ Add database indexes
- ✅ Implement Redis caching
- ✅ Enable connection pooling
- ✅ Use async processing for heavy tasks
- ✅ Optimize N+1 queries
- ✅ Enable HTTP/2
- ✅ Implement rate limiting

### Infrastructure
- ✅ Use CDN (CloudFlare, CloudFront)
- ✅ Enable auto-scaling
- ✅ Implement health checks
- ✅ Use load balancer
- ✅ Set up monitoring and alerts
- ✅ Regular performance testing
