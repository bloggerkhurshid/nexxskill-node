# NexxSkill REST API (Node.js & Express)

High-performance, production-ready Node.js REST API backend for the NexxSkill Platform monorepo (`public-web` and `admin-panel`). It mirrors 100% of the PHP backend endpoints and database schema with enhanced speed and modern JavaScript/ESM features.

---

## 🏗️ Architecture & Features

- **Runtime**: Node.js v20+ with native ES Modules (`"type": "module"`)
- **Web Framework**: Express.js with JSON & URL-encoded parsers + raw body capture for webhooks
- **Database**: MySQL 8.0+ connection pool via `mysql2/promise` with auto-migration of missing tables/columns
- **Authentication**: JWT authentication with `firebase/php-jwt` parity, password hashing via `bcryptjs`
- **Roles**: Student & Admin role-based middleware (`requireAuth`, `requireAdmin`, `optionalAuth`)
- **Payments**: Razorpay integration (`Razorpay` SDK) with test/demo fallback and webhook signature verification
- **Media Uploads**: High-throughput file uploads via `multer` (up to 500MB video uploads)
- **Emails**: Transactional HTML emails via `nodemailer` (SMTP with mock fallback for local dev)
- **Compatibility**: Supports both direct endpoints (`/courses`, `/auth/login`) and `/v1` prefix (`/v1/courses`, `/v1/auth/login`)

---

## 📁 Project Structure

```
api-node/
├── .env                  # Environment variables
├── .env.example          # Sample environment template
├── package.json          # Dependencies and scripts
├── uploads/
│   └── videos/           # Uploaded video files
├── src/
│   ├── index.js          # Express app entry point
│   ├── config/
│   │   └── db.js         # MySQL connection pool & auto-migrations
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── couponController.js
│   │   ├── courseController.js
│   │   ├── leadController.js
│   │   ├── paymentController.js
│   │   └── studentController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── couponRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── index.js
│   │   ├── leadRoutes.js
│   │   ├── paymentRoutes.js
│   │   └── studentRoutes.js
│   ├── scripts/
│   │   └── seed.js       # Standalone DB initialization & seed script
│   └── services/
│       ├── jwtService.js
│       ├── mailService.js
│       └── razorpayService.js
└── test/
    ├── api.test.js       # Unit tests for JWT & Razorpay
    └── http.test.js      # Integration HTTP route tests
```

---

## 🚀 Quick Setup & Run

### 1. Install Dependencies
```bash
cd api-node
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` (already done by default) and update MySQL/Razorpay credentials:
```ini
PORT=5000
NODE_ENV=development
APP_SECRET=nexxskill_jwt_super_secret_key_2026_change_me_in_prod

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=nexxskill_db
DB_USER=root
DB_PASS=

RAZORPAY_KEY_ID=rzp_test_TPuzQT6xD1Otnp
RAZORPAY_KEY_SECRET=rVNLcdLoaPW2z9PsSQmcP9yZf
RAZORPAY_WEBHOOK_SECRET=VNLcdLoaPW2z9PsSQmcP9yZf
```

### 3. Start Development Server
```bash
npm run dev
```
Server runs on: `http://localhost:5000` (API Base: `http://localhost:5000/v1` or `http://localhost:5000`).

### 4. Run Automated Tests
```bash
npm test
```

### 5. Standalone Database Seed
```bash
npm run seed
```

---

## 🔌 Connecting Frontend to Node.js Backend

In `public-web/.env` and `admin-panel/.env`, point to the Node backend:
```ini
VITE_API_BASE_URL=http://localhost:5000
```
Or for production:
```ini
VITE_API_BASE_URL=https://your-node-api-domain.com
```

---

## 📡 API Endpoints Reference

### Public Endpoints
- `GET /health` or `GET /` — API health check
- `POST /auth/register` — Register new student account
- `POST /auth/login` — Login user (student/admin) and receive JWT
- `GET /courses` — Get list of published courses
- `GET /courses/:slug` — Get details of a single course by slug
- `POST /leads` — Submit lead inquiry form
- `POST /contact` — Submit general contact message
- `GET /webinars` — Get scheduled webinars and seats left
- `POST /webinars/register` — Reserve seat for webinar
- `GET /faqs` — Get frequently asked questions

### Student Endpoints (Header: `Authorization: Bearer <token>`)
- `GET /auth/me` — Get current authenticated user profile
- `GET /student/enrollments` — List paid enrolled courses with video links
- `GET /student/profile` — Get profile + webinar bookings
- `PUT /student/profile` — Update name/phone
- `POST /coupons/validate` — Validate promo code discount
- `POST /payments/create-order` — Create Razorpay order (or free enrollment on 100% coupon)
- `POST /payments/verify` — Verify signature and activate enrollment
- `DELETE /webinars/:id/booking` — Cancel webinar booking

### Admin Endpoints (Header: `Authorization: Bearer <admin_token>`)
- `GET /admin/overview` — Dashboard stats (revenue, enrollments, leads, students, recent activity)
- `GET /admin/courses` — List all courses
- `POST /admin/courses` — Create new course
- `PUT /admin/courses/:id` — Update course
- `DELETE /admin/courses/:id` — Delete course
- `GET /admin/enrollments` — List all enrollments
- `PUT /admin/enrollments/:id` — Update enrollment status (`paid`, `refunded`, etc.)
- `DELETE /admin/enrollments/:id` — Delete enrollment order
- `GET /admin/leads` — List leads
- `PUT /admin/leads/:id` — Update lead status (`contacted`, `converted`)
- `GET /admin/messages` — List contact messages
- `PUT /admin/messages/:id` — Update message status (`resolved`, `unresolved`)
- `GET /admin/students` — List registered students with enrollment counts
- `GET /admin/webinars/registrations` — List all webinar attendee registrations
- `POST /admin/webinars` — Create webinar
- `PUT /admin/webinars/:id` — Update webinar
- `DELETE /admin/webinars/:id` — Delete webinar
- `POST /admin/faqs` — Create FAQ
- `PUT /admin/faqs/:id` — Update FAQ
- `DELETE /admin/faqs/:id` — Delete FAQ
- `GET /admin/coupons` — List discount coupons with usage count
- `POST /admin/coupons` — Create coupon
- `PUT /admin/coupons/:id` — Update coupon
- `DELETE /admin/coupons/:id` — Delete coupon
- `POST /admin/upload` — Upload video media files to server (`uploads/videos`)
