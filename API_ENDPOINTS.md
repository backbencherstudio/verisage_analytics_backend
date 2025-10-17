# Verisage Analytics Backend - API Endpoints

## Base URL
```
http://localhost:4000
```

---

## 📊 Analytics Endpoints

### 1. Customer Analytics
**GET** `/api/analytics/customers`

Get comprehensive customer analytics including growth, churn, LTV, and segmentation.

**Query Parameters:**
- `startDate` (optional): ISO date string (e.g., `2025-01-01`)
- `endDate` (optional): ISO date string (e.g., `2025-12-31`)

**Example Request:**
```http
GET http://localhost:4000/api/analytics/customers?startDate=2025-01-01&endDate=2025-12-31
```

**Example Response:**
```json
{
  "totalCustomers": 150,
  "newCustomers": 25,
  "churnedCustomers": 5,
  "customerGrowthRate": 15.5,
  "averageCustomerLifetime": 12.5,
  "customersByCountry": [
    { "country": "United States", "count": 100 },
    { "country": "Canada", "count": 30 }
  ],
  "topCustomersByRevenue": [
    {
      "customerId": "cus_abc123",
      "email": "customer@example.com",
      "totalRevenue": 50000,
      "subscriptionCount": 2
    }
  ]
}
```

---

### 2. Revenue Analytics
**GET** `/api/analytics/revenue`

Get detailed revenue metrics including MRR, ARR, revenue by plan, and trends.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Example Request:**
```http
GET http://localhost:4000/api/analytics/revenue?startDate=2025-01-01&endDate=2025-12-31
```

**Example Response:**
```json
{
  "totalRevenue": 125000,
  "netRevenue": 120000,
  "totalRefunds": 5000,
  "mrr": 10000,
  "arr": 120000,
  "averageRevenuePerCustomer": 800,
  "revenueGrowthRate": 12.5,
  "revenueByCurrency": [
    { "currency": "usd", "revenue": 100000 },
    { "currency": "eur", "revenue": 25000 }
  ],
  "revenueByPlan": [
    { "plan": "Pro", "revenue": 75000, "percentage": 60 },
    { "plan": "Basic", "revenue": 50000, "percentage": 40 }
  ],
  "revenueOverTime": [
    { "date": "2025-01-01", "revenue": 9500 },
    { "date": "2025-02-01", "revenue": 10000 }
  ]
}
```

---

### 3. Subscription Analytics
**GET** `/api/analytics/subscriptions`

Get subscription metrics including active, trialing, canceled, and retention rates.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Example Request:**
```http
GET http://localhost:4000/api/analytics/subscriptions?startDate=2025-01-01
```

**Example Response:**
```json
{
  "totalSubscriptions": 200,
  "activeSubscriptions": 180,
  "trialingSubscriptions": 15,
  "canceledSubscriptions": 5,
  "subscriptionGrowthRate": 10.5,
  "averageSubscriptionLength": 18.5,
  "churnRate": 2.5,
  "retentionRate": 97.5,
  "subscriptionsByStatus": [
    { "status": "active", "count": 180 },
    { "status": "trialing", "count": 15 }
  ],
  "upcomingRenewals": [
    {
      "subscriptionId": "sub_abc123",
      "customerId": "cus_abc123",
      "renewalDate": "2025-11-01",
      "amount": 2999
    }
  ]
}
```

---

### 4. Payment Analytics
**GET** `/api/analytics/payments`

Get payment metrics including success rate, failed payments, and processing times.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Example Request:**
```http
GET http://localhost:4000/api/analytics/payments?startDate=2025-10-01
```

**Example Response:**
```json
{
  "totalPayments": 500,
  "successfulPayments": 475,
  "failedPayments": 25,
  "paymentSuccessRate": 95.0,
  "totalPaymentVolume": 150000,
  "averagePaymentAmount": 300,
  "paymentsByCurrency": [
    { "currency": "usd", "count": 450, "totalAmount": 135000 }
  ],
  "paymentsByStatus": [
    { "status": "succeeded", "count": 475 },
    { "status": "failed", "count": 25 }
  ],
  "failedPaymentReasons": [
    { "reason": "insufficient_funds", "count": 15 },
    { "reason": "card_declined", "count": 10 }
  ],
  "recentPayments": [
    {
      "id": "pi_abc123",
      "customerId": "cus_abc123",
      "amount": 2999,
      "status": "succeeded",
      "paidAt": "2025-10-15T10:30:00Z"
    }
  ]
}
```

---

### 5. Refund Analytics
**GET** `/api/analytics/refunds`

Get refund metrics and trends.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Example Request:**
```http
GET http://localhost:4000/api/analytics/refunds?startDate=2025-01-01&endDate=2025-12-31
```

**Example Response:**
```json
{
  "totalRefunds": 50,
  "totalRefundAmount": 15000,
  "refundRate": 3.2,
  "averageRefundAmount": 300,
  "refundsByReason": [
    { "reason": "customer_request", "count": 30, "amount": 9000 },
    { "reason": "fraudulent", "count": 10, "amount": 3000 }
  ],
  "refundsByCurrency": [
    { "currency": "usd", "count": 45, "totalAmount": 13500 }
  ],
  "recentRefunds": [
    {
      "id": "re_abc123",
      "paymentId": "pi_abc123",
      "amount": 2999,
      "reason": "customer_request",
      "createdAt": "2025-10-15T10:30:00Z"
    }
  ]
}
```

---

### 6. Plan/Pricing Analytics
**GET** `/api/analytics/plans`

Get plan performance metrics, popular plans, and upgrade/downgrade analysis.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Example Request:**
```http
GET http://localhost:4000/api/analytics/plans?startDate=2025-01-01
```

**Example Response:**
```json
{
  "totalPlans": 5,
  "activePlans": 4,
  "planPerformance": [
    {
      "planId": "price_abc123",
      "planName": "Pro Plan",
      "stripePriceId": "price_abc123",
      "amount": 2999,
      "currency": "usd",
      "interval": "month",
      "activeSubscriptions": 150,
      "totalRevenue": 449850,
      "averageRevenuePerSubscription": 2999,
      "churnRate": 2.5
    }
  ],
  "popularPlans": [
    {
      "planId": "price_abc123",
      "planName": "Pro Plan",
      "subscriptionCount": 150,
      "revenue": 449850
    }
  ],
  "planDistribution": [
    { "planName": "Pro Plan", "subscriptionCount": 150, "percentage": 75 },
    { "planName": "Basic Plan", "subscriptionCount": 50, "percentage": 25 }
  ],
  "revenueByPlan": [
    {
      "planName": "Pro Plan",
      "totalRevenue": 449850,
      "percentageOfTotal": 75
    }
  ],
  "planUpgradeDowngrade": [
    {
      "fromPlan": "Basic Plan",
      "toPlan": "Pro Plan",
      "count": 15,
      "type": "upgrade"
    }
  ]
}
```

---

## 🔄 Stripe Sync Endpoints

### 7. Trigger Stripe Sync
**POST** `/api/stripe/sync`

Manually trigger a full Stripe data sync (customers, subscriptions, invoices, payments).

**Headers:**
```
Content-Type: application/json
```

**Example Request:**
```http
POST http://localhost:4000/api/stripe/sync
Content-Type: application/json
```

**Example Response:**
```json
{
  "message": "Stripe sync initiated successfully",
  "syncLog": {
    "id": "log_abc123",
    "syncType": "stripe",
    "status": "in_progress",
    "startedAt": "2025-10-16T10:30:00Z"
  }
}
```

---

### 8. Get Sync Status
**GET** `/api/stripe/sync/status`

Get the status of the last Stripe sync operation.

**Example Request:**
```http
GET http://localhost:4000/api/stripe/sync/status
```

**Example Response:**
```json
{
  "syncLog": {
    "id": "log_abc123",
    "syncType": "stripe",
    "lastSyncAt": "2025-10-16T10:30:00Z",
    "nextSyncAt": "2025-10-16T11:30:00Z",
    "status": "success",
    "recordsSynced": 250,
    "recordsFailed": 0,
    "duration": 45000,
    "errorMessage": null
  }
}
```

---

## 🔐 Authentication Endpoints

### 9. User Login
**POST** `/api/auth/login`

Authenticate a user and receive a JWT token.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

**Example Request:**
```http
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}
```

**Example Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_abc123",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

---

### 10. User Registration
**POST** `/api/auth/register`

Register a new user account.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "name": "New User"
}
```

**Example Request:**
```http
POST http://localhost:4000/api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "name": "New User"
}
```

**Example Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_xyz789",
    "email": "newuser@example.com",
    "name": "New User",
    "role": "user"
  }
}
```

---

### 11. Get Current User
**GET** `/api/auth/me`

Get the currently authenticated user's information.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Example Request:**
```http
GET http://localhost:4000/api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example Response:**
```json
{
  "id": "user_abc123",
  "email": "admin@example.com",
  "name": "Admin User",
  "role": "admin",
  "lastLoginAt": "2025-10-16T09:00:00Z",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

## 👥 Stripe User Management

### 12. Get All Stripe Users/Customers
**GET** `/api/stripe/users`

Get a list of all Stripe customers with their subscription details.

**Query Parameters:**
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```http
GET http://localhost:4000/api/stripe/users?limit=50&offset=0
```

**Example Response:**
```json
{
  "customers": [
    {
      "id": "cus_abc123",
      "email": "customer@example.com",
      "name": "Customer Name",
      "stripeCustomerId": "cus_abc123",
      "subscriptions": [
        {
          "id": "sub_abc123",
          "status": "active",
          "currentPeriodEnd": "2025-11-01T00:00:00Z"
        }
      ],
      "totalRevenue": 5000,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

### 13. Get Stripe Metrics
**GET** `/api/metrics`

Get overall Stripe metrics dashboard.

**Example Request:**
```http
GET http://localhost:4000/api/metrics
```

**Example Response:**
```json
{
  "customers": {
    "total": 150,
    "new": 25,
    "churned": 5
  },
  "subscriptions": {
    "total": 200,
    "active": 180,
    "trialing": 15,
    "canceled": 5
  },
  "revenue": {
    "mrr": 10000,
    "arr": 120000,
    "totalRevenue": 125000
  },
  "payments": {
    "total": 500,
    "successful": 475,
    "failed": 25,
    "successRate": 95.0
  }
}
```

---

## 🪝 Webhook Endpoint

### 14. Stripe Webhook Handler
**POST** `/api/stripe/webhook`

Endpoint for receiving Stripe webhook events. This should be configured in your Stripe Dashboard.

**Headers:**
```
stripe-signature: WEBHOOK_SIGNATURE_FROM_STRIPE
Content-Type: application/json
```

**Note:** This endpoint is called by Stripe automatically. Configure it in your Stripe Dashboard:
- Webhook URL: `https://yourdomain.com/api/stripe/webhook`
- Events to subscribe to:
  - `customer.created`
  - `customer.updated`
  - `customer.deleted`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `charge.refunded`

---

## 🏥 Health Check

### 15. Basic Health Check
**GET** `/health`

Check if the API is running.

**Example Request:**
```http
GET http://localhost:4000/health
```

**Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-16T10:30:00Z",
  "uptime": 3600,
  "environment": "development"
}
```

---

## 📝 Additional Notes

### Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Error Responses
All endpoints follow a standard error format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

### Date Formats
All dates should be in ISO 8601 format:
- `2025-10-16` (Date only)
- `2025-10-16T10:30:00Z` (Full datetime with timezone)

### Pagination
Endpoints that return lists support pagination:
- `limit`: Number of items per page (default: 100, max: 1000)
- `offset`: Number of items to skip (default: 0)

---

## 🧪 Testing with Insomnia

### Quick Start
1. **Create a new Request Collection** in Insomnia named "Verisage Analytics"
2. **Set Base URL**: Create an environment variable `base_url = http://localhost:4000`
3. **Test Health Check** first: `GET {{base_url}}/health`
4. **Register a User**: `POST {{base_url}}/api/auth/register`
5. **Save the Token**: Store the JWT token from the response
6. **Test Analytics**: Try all the analytics endpoints with your token

### Sample Insomnia Workflow
```
1. Health Check (GET /health)
2. Register User (POST /api/auth/register)
3. Login (POST /api/auth/login) → Save token
4. Get Current User (GET /api/auth/me) → Use token
5. Trigger Stripe Sync (POST /api/stripe/sync) → Use token
6. Check Sync Status (GET /api/stripe/sync/status)
7. Customer Analytics (GET /api/analytics/customers)
8. Revenue Analytics (GET /api/analytics/revenue)
9. Subscription Analytics (GET /api/analytics/subscriptions)
10. Payment Analytics (GET /api/analytics/payments)
11. Refund Analytics (GET /api/analytics/refunds)
12. Plan Analytics (GET /api/analytics/plans)
```

### Environment Variables for Insomnia
Create these environment variables in Insomnia:

```json
{
  "base_url": "http://localhost:4000",
  "auth_token": "YOUR_JWT_TOKEN_HERE",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}
```

Then use them in your requests:
- URL: `{{base_url}}/api/analytics/revenue`
- Header: `Authorization: Bearer {{auth_token}}`
- Query: `?startDate={{start_date}}&endDate={{end_date}}`

---

## 🚀 Production Deployment

When deploying to production:

1. **Update Base URL** to your production domain
2. **Enable HTTPS** for all endpoints
3. **Configure Stripe Webhook** with your production URL
4. **Set Environment Variables**:
   - `DATABASE_URL`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `JWT_SECRET`
   - `GA4_PROPERTY_ID`
   - `GA4_CREDENTIALS` (service account JSON)

---

**Version:** 1.0.0  
**Last Updated:** October 16, 2025
