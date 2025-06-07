# Web Push Notification Microservice

A scalable and maintainable web push notification service built with Node.js and SQLite.

## Features

- Push notification sending and management
- Subscription storage and management
- Notification history tracking
- Error logging and monitoring
- Input validation
- Database persistence
- Health check endpoint

## API Endpoints

### Save Subscription
```http
POST /api/subscriptions
```

### Send Notification
```http
POST /api/notifications
```

### Get Notification History
```http
GET /api/notifications
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file with your VAPID keys:
   ```
   PORT=4000
   VAPID_PUBLIC_KEY=your_public_key
   VAPID_PRIVATE_KEY=your_private_key
   VAPID_EMAIL=your_email
   ```

3. Start the server:
   ```bash
   npm start
   ```

For development:
```bash
npm run dev
```

## Project Structure

- `/src`
  - `/config` - Configuration files
  - `/middleware` - Express middleware
  - `/routes` - API routes
  - `/services` - Business logic
  - `/utils` - Utility functions
- `/logs` - Application logs
- `/data` - SQLite database