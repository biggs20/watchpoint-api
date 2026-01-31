# WatchPoint API

Backend API for WatchPoint - a website monitoring and change detection service.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Cache/Queue:** Redis + BullMQ
- **Email:** SendGrid
- **SMS:** Twilio
- **Payments:** Stripe
- **Authentication:** JWT

## Project Structure

```
watchpoint-api/
├── src/
│   ├── index.js              # Express server entry point
│   ├── config/               # Service configurations
│   │   ├── database.js       # PostgreSQL connection pool
│   │   ├── redis.js          # Redis client + cache helpers
│   │   ├── stripe.js         # Stripe client
│   │   ├── sendgrid.js       # SendGrid email client
│   │   └── twilio.js         # Twilio SMS client
│   ├── middleware/           # Express middleware
│   │   ├── auth.js           # JWT authentication
│   │   ├── rateLimiter.js    # Rate limiting
│   │   └── errorHandler.js   # Global error handling
│   ├── routes/               # API route handlers
│   │   ├── auth.js           # Authentication routes
│   │   ├── watches.js        # Watch CRUD routes
│   │   ├── billing.js        # Subscription/billing routes
│   │   ├── webhooks.js       # Stripe webhook handlers
│   │   └── feedback.js       # User feedback routes
│   ├── services/             # Business logic layer
│   │   ├── userService.js    # User management
│   │   ├── watchService.js   # Watch management
│   │   ├── snapshotService.js      # Snapshot storage
│   │   ├── changeDetectionService.js # Change detection logic
│   │   ├── notificationService.js  # Email/SMS notifications
│   │   └── billingService.js       # Stripe integration
│   ├── workers/              # Background job processors
│   │   ├── monitorWorker.js  # URL monitoring worker
│   │   ├── notifyWorker.js   # Notification sender
│   │   ├── digestWorker.js   # Daily/weekly digest worker
│   │   └── scheduler.js      # Cron job scheduler
│   └── utils/                # Utility functions
│       ├── encryption.js     # Data encryption
│       ├── diffEngine.js     # Content diff generation
│       └── logger.js         # Logging utility
├── .env.example              # Environment variable template
├── package.json
└── README.md
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/watchpoint-api.git
   cd watchpoint-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with your credentials:
   - Database connection string
   - Redis URL
   - JWT secret (generate a secure random string)
   - SendGrid API key
   - Twilio credentials
   - Stripe API keys

5. Set up the database:
   ```bash
   # Create database
   createdb watchpoint
   
   # Run migrations (TODO: add migration files)
   npm run migrate
   ```

### Running the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Watches
- `GET /api/watches` - List user's watches
- `POST /api/watches` - Create new watch
- `GET /api/watches/:id` - Get watch details
- `PUT /api/watches/:id` - Update watch
- `DELETE /api/watches/:id` - Delete watch
- `POST /api/watches/:id/pause` - Pause monitoring
- `POST /api/watches/:id/resume` - Resume monitoring
- `GET /api/watches/:id/snapshots` - Get watch snapshots

### Billing
- `GET /api/billing/subscription` - Get subscription status
- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/portal` - Create billing portal session
- `GET /api/billing/invoices` - Get invoice history
- `POST /api/billing/cancel` - Cancel subscription

### Health Check
- `GET /health` - Server health status

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `NODE_ENV` | Environment (development/production) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `ENCRYPTION_KEY` | Key for encrypting sensitive data |
| `SENDGRID_API_KEY` | SendGrid API key |
| `FROM_EMAIL` | Sender email address |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `APP_URL` | Application URL |

## TODO

- [ ] Implement all service layer functions
- [ ] Implement all route handlers
- [ ] Set up database migrations
- [ ] Add input validation (express-validator)
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add tests (Jest)
- [ ] Set up CI/CD pipeline
- [ ] Add Docker configuration

## License

ISC
