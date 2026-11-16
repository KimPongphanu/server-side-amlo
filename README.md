# AMLO Backend API

This is the backend REST API for the AMLO system, built with Node.js, Express, and Prisma ORM.

## 🚀 Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via Docker)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: JWT (JSON Web Tokens) & 2FA (Email OTP + Google Authenticator)
- **Language**: TypeScript

## 📦 Core Features

- **Robust Authentication**: Secure login with password hashing (bcrypt), brute-force protection, and Two-Factor Authentication (OTP via Email & Google Authenticator TOTP).
- **Admin 2FA**: Admins use the same TOTP + recovery-key flow as Supervisors.
- **Role-Based Access Control**: Differentiates between `ADMIN` and `SUPERVISOR` roles.
- **Supervisor Approval Workflow**: Critical actions (like deleting a user or resetting passwords) require approval requests between Supervisors.
- **Audit Logging**: Comprehensive tracking of user logins, admin actions, and system modifications.
- **Media Uploads**: Built-in file handling using `multer` for image uploads.
- **Dynamic XML Sitemap**: `GET /sitemap.xml` is generated from published news, PR, and departments.
- **Popup Image Replacement**: `PUT /api/splash-popups/:id` accepts multipart image uploads.

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (for the PostgreSQL database)
- PostgreSQL (if not using Docker)

### Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   cd AMLO_website/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file for local development and a `.env.docker` file if running the app within Docker.
   ```env
   # Database connection (Use localhost for local dev, or amlo-db for Docker network)
   DATABASE_URL="postgresql://postgres:12345@localhost:5432/backend_amlo?schema=public"
   
   # JWT & Security Secrets
   JWT_SECRET="your-secure-jwt-secret-key"
   MASTER_KEY="your-master-key-for-supervisor-creation"
   
   # Seed default credentials (required by prisma/seed.ts — `npm run seed`)
   # No hardcoded fallbacks: the seed script exits if these are missing.
   SEED_SUPERVISOR_EMAIL="root-supervisor@example.com"
   SEED_SUPERVISOR_PASSWORD="change-me-strong-password"
   SEED_ADMIN_EMAIL="default-admin@example.com"
   SEED_ADMIN_PASSWORD="change-me-strong-password"
   
   # SMTP Settings for OTP Emails
   SMTP_HOST="smtp.ethereal.email"
   SMTP_PORT=587
   SMTP_USER="your-email"
   SMTP_PASS="your-password"
   
   # Optional: canonical public URL for /sitemap.xml
   # If empty, the backend derives it from the request Host + X-Forwarded-Proto.
   SITE_URL="https://www.amlo.go.th"
   ```

### Database Setup

1. Start the PostgreSQL database (via Docker):
   ```bash
   docker-compose up -d
   ```

2. Apply the Prisma migrations:
   ```bash
   npx prisma migrate deploy
   ```
   *(For local schema changes, use `npx prisma migrate dev` instead.)*

3. Seed the initial data (Admins, Supervisors, default settings):
   ```bash
   npm run seed
   ```

### Running the Server

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

## 🐳 Docker Deployment

To run both the database and the backend API fully containerized:

1. Ensure `.env.docker` is correctly configured with `amlo-db` as the database host.
2. Build and run the containers:
   ```bash
   docker network create amlo-network
   docker build -t amlo-backend .
   docker run -d --name amlo-backend --network amlo-network --env-file .env.docker -p 8080:8080 amlo-backend
   ```

## 📂 Project Structure

- `/controllers/` - API route logic and business rules
- `/middlewares/` - Express middlewares (Auth, Role Checking, Rate Limiting)
- `/routes/` - Express route definitions
- `/prisma/` - Database schema, migrations, and seed scripts
- `/services/` - Reusable business logic (Email sending, 2FA generation)
- `/utils/` - Helper functions (Audit logging, IP selection)
- `/uploads/` - Static directory for uploaded files
