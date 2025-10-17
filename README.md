# Verisage Analytics Backend

Backend API for collecting and serving Stripe subscription and GA4 analytics data.

## Features

- 📊 Stripe webhook integration for real-time subscription data
- 📈 Google Analytics 4 data collection with scheduled sync
- 🗄️ PostgreSQL database with Prisma ORM
- ⚡ Express.js REST API
- 🔄 Automated data synchronization with cron jobs

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Integrations:** Stripe API, Google Analytics Data API

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- Stripe account with API keys
- Google Analytics 4 property with service account

## Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Set up database:**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

4. **Optional - Seed database:**
   ```bash
   npm run prisma:seed
   ```

## Development

```bash
npm run dev
```

The server will start on `http://localhost:4000`

## Project Structure

```
├─ src/
│  ├─ app.ts                    # Express app configuration
│  ├─ server.ts                 # Server entry point
│  ├─ config/env.ts             # Environment configuration
│  ├─ db/prisma.ts              # Prisma client instance
│  ├─ routes/index.ts           # Main router
│  ├─ routes/stripe.webhook.ts # Stripe webhook endpoints
│  ├─ routes/metrics.route.ts  # Metrics API endpoints
│  ├─ services/stripe.service.ts # Stripe business logic
│  ├─ services/ga4.service.ts   # GA4 data fetching
│  ├─ jobs/ga4.cron.ts          # Scheduled GA4 sync
│  ├─ utils/normalizers.ts      # Data transformation utilities
│  └─ types/stripe.d.ts         # TypeScript type definitions
├─ prisma/
│  ├─ schema.prisma             # Database schema
│  └─ seed.ts                   # Database seed data
```

## API Endpoints

### Stripe Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

### Metrics
- `GET /api/metrics/stripe` - Get Stripe subscription metrics
- `GET /api/metrics/ga4` - Get GA4 analytics data
- `GET /api/metrics/dashboard` - Get combined dashboard data

## Database Management

- **Prisma Studio:** `npm run prisma:studio`
- **Generate Client:** `npm run prisma:generate`
- **Run Migrations:** `npm run prisma:migrate`

## Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Start production server:
   ```bash
   npm start
   ```

## Environment Variables

See `.env.example` for all required configuration options.

## License

ISC
