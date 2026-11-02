# 🚀 Team Member Local Setup Guide
## International Sports Solutions — Multi-Tenant Sports SaaS

Welcome to the **International Sports Solutions** project!  
This guide is written especially for beginners and new teammates. Follow these instructions step-by-step to set up and run the entire application on your local computer from scratch.

> [!NOTE]
> **No PHP, Composer, MySQL, or Apache/Nginx required!**  
> The application is 100% pure Node.js + Express. The database uses embedded SQLite (`better-sqlite3`), meaning the database files are stored right inside the project folder. You do not need to install or configure any external database server.

---

## 📋 Table of Contents
1. [Required Softwares to Install](#1-required-softwares-to-install)
2. [Step 1: Download / Clone the Repository from GitHub](#step-1-download--clone-the-repository-from-github)
3. [Step 2: Environment Configuration (.env)](#step-2-environment-configuration-env)
4. [Step 3: Install Node.js Dependencies](#step-3-install-nodejs-dependencies)
5. [Step 4: Initialize Database & Run Migrations](#step-4-initialize-database--run-migrations)
6. [Step 5: Local Domain Setup (Optional / Recommended)](#step-5-local-domain-setup-optional--recommended)
7. [Step 6: Start the Application Server](#step-6-start-the-application-server)
8. [Step 7: How to Open & Access the Application](#step-7-how-to-open--access-the-application)
9. [Step 8: Demo Accounts & Login Credentials](#step-8-demo-accounts--login-credentials)
10. [Step 9: Run Automated Tests & Quality Checks](#step-9-run-automated-tests--quality-checks)
11. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## 1. Required Softwares to Install

Before you begin, make sure you have the following free tools installed on your computer:

### 1.1 Git (Version Control)
- **What it is:** Tool used to download and sync code from GitHub.
- **Download Link:** [https://git-scm.com/downloads](https://git-scm.com/downloads)
- **Installation:** Download the installer for Windows/macOS and complete the setup using default options.
- **Verification:** Open your terminal (PowerShell, Command Prompt, or Terminal) and type:
  ```bash
  git --version
  ```
  *(You should see something like `git version 2.40.0` or higher)*

### 1.2 Node.js (JavaScript Runtime)
- **What it is:** The runtime engine that executes the application backend.
- **Download Link:** [https://nodejs.org/](https://nodejs.org/)
- **Recommended Version:** **Node.js 20 LTS** or **Node.js 22 LTS**.
- **Installation:** Download the **LTS (Long Term Support)** installer and follow the setup wizard.
- **Verification:** Open your terminal and check both Node and NPM:
  ```bash
  node -v
  npm -v
  ```
  *(Expected: `v20.x.x` or higher for Node, and `10.x.x` or higher for npm)*

### 1.3 Code Editor (Recommended: Visual Studio Code)
- **Download Link:** [https://code.visualstudio.com/](https://code.visualstudio.com/)
- Install extensions for a great development experience:
  - *ESLint*
  - *SQLite Viewer* (to inspect `.db` database files directly in VS Code)

### 1.4 Web Browser
- Google Chrome, Microsoft Edge, or Mozilla Firefox.

---

## Step 1: Download / Clone the Repository from GitHub

1. Open your terminal or PowerShell.
2. Navigate to the folder where you want to store your projects (for example, `C:\Projects` or `~/projects`):
   ```bash
   cd C:\Projects
   ```
3. Clone the repository from GitHub:
   ```bash
   git clone https://github.com/anilvaja/InternationalSportsSolutions.git
   ```
4. Enter the project directory:
   ```bash
   cd InternationalSportsSolutions
   ```
5. **Switch to the active Node.js rebuild branch (`node-express-rebuild`)**:
   ```bash
   git checkout node-express-rebuild
   ```
6. Pull the latest updates to make sure your local copy is completely up to date:
   ```bash
   git pull origin node-express-rebuild
   ```

---

## Step 2: Environment Configuration (`.env`)

The application needs an environment file named `.env` in the root folder.

1. In the project root, copy `.env.example` to create `.env`:
   - **On Windows (PowerShell):**
     ```powershell
     Copy-Item .env.example .env
     ```
   - **On macOS / Linux / Git Bash:**
     ```bash
     cp .env.example .env
     ```
2. By default, the `.env` file comes pre-configured with working development settings:
   ```env
   PORT=3005
   NODE_ENV=development
   JWT_SECRET=iss_sports_saas_super_secret_jwt_key_2026
   JWT_EXPIRES_IN=7d
   APP_URL=http://localhost:3005
   BASE_DOMAIN=internationalsportssolutions.test
   ```
   *(No changes are needed for normal local development!)*

---

## Step 3: Install Node.js Dependencies

Install all required packages specified in `package.json`:

```bash
npm install
```

> [!TIP]
> This command installs Express, better-sqlite3, JWT authentication, bcrypt, multer, sharp, and Playwright for testing. It usually takes 30–60 seconds.

---

## Step 4: Initialize Database & Run Migrations

The application uses an isolated **Physical Database-Per-Tenant** SQLite architecture:
- `data/central.db` → Central database for SaaS subscription plans, academies, and super admins.
- `data/academies/academy_1.db` → Dedicated tenant database for **Pratik Karate Academy**.

### 4.1 Seed Initial Demo Data
Run the seeder to initialize the database with default accounts, branches, belts, syllabus, batches, and coaches:
```bash
npm run seed
```
*(You will see a confirmation message: `✔ Central database seeded successfully` and `✔ Default tenant Pratik Karate Academy initialized`)*

### 4.2 Apply Database Schema Migrations
Run the automated migration runner to apply all schema upgrades (migrations `001` through `029`):
```bash
npm run migrate
```
*(You will see: `Applied migration: 001_initial_schema.sql` ... `Applied migration: 029_organization_documents_and_compliance.sql`)*

---

## Step 5: Local Domain Setup (Optional / Recommended)

The SaaS platform supports multi-tenant domain resolution (e.g., `pratik-karate.internationalsportssolutions.test`).

You have two choices:

### Option A: Standard `localhost:3005` (Zero Configuration)
- Works immediately without touching any system settings.
- Simply open `http://localhost:3005` in your browser.

### Option B: Local Domain Host Mapping (Recommended for Full SaaS Experience)
If you want to test domain-based tenant resolution just like production:

1. Open your system's `hosts` file with Administrator privileges:
   - **Windows:** Open Notepad as Administrator → Open `C:\Windows\System32\drivers\etc\hosts`
   - **macOS / Linux:** Run `sudo nano /etc/hosts`
2. Add these two lines at the bottom of the file:
   ```text
   127.0.0.1 internationalsportssolutions.test
   127.0.0.1 pratik-karate.internationalsportssolutions.test
   ```
3. Save the file.

---

## Step 6: Start the Application Server

Start the local server using npm:

### Normal Start:
```bash
npm start
```

### Or Development Mode (Auto-restarts when you edit files):
```bash
npm run server:dev
```

You should see the following startup banner in your terminal:
```text
======================================================
 International Sports Solutions - Multi-Tenant Platform
 Server running on http://localhost:3005
 Base Domain URL: http://internationalsportssolutions.test:3005
 Database: Isolated SQLite per Tenant
======================================================
✔ Direct HTTP Port 80 Active: http://internationalsportssolutions.test/
```

> [!NOTE]
> Keep this terminal window open while using the application. To stop the server at any time, press `Ctrl + C`.

---

## Step 7: How to Open & Access the Application

Open your browser and navigate to the desired portal:

| Portal | URL (Localhost) | URL (Local Domain) | Description |
|---|---|---|---|
| **Academy Management** | `http://localhost:3005/` | `http://pratik-karate.internationalsportssolutions.test:3005/` | Main portal for Academy Admin, Coaches, Receptionist & Staff |
| **Super Admin Panel** | `http://localhost:3005/central` | `http://internationalsportssolutions.test:3005/central` | Multi-Tenant Platform Management, Onboarding, Subscription Plans |
| **Student Self-Service** | `http://localhost:3005/student` | `http://pratik-karate.internationalsportssolutions.test:3005/student` | Student Portal (attendance history, belt curriculum, fee dues) |
| **Public Payments & Inquiry** | `http://localhost:3005/pay.html` | `http://pratik-karate.internationalsportssolutions.test:3005/pay.html` | Public student fee invoice payments & admission inquiries |

---

## Step 8: Demo Accounts & Login Credentials

All accounts are pre-seeded in the database for testing:

### 1. Central Platform
- **Role:** Super Admin
- **Email:** `anilvaja.007@gmail.com`
- **Password:** `password`
- **URL:** `http://localhost:3005/central`

### 2. Pratik Karate Academy Staff & Management
| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Academy Admin** | `admin@pratikkarate.com` | `password123` | Full academy operations, billing, payroll, staff, settings |
| **Head Coach** | `pratik.headcoach@pratikkarate.com` | `coach123` | Syllabus management, batch management, coach oversight |
| **Coach** | `rajesh.kumite@pratikkarate.com` | `coach123` | Class attendance, technique grading, personal salary |
| **Finance Manager** | `anita.finance@pratikkarate.com` | `staff123` | Fee collection, invoices, receipts, payment ledgers |
| **Front Desk** | `vikram.staff@pratikkarate.com` | `staff123` | Student admissions, parent inquiries, attendance |
| **Receptionist** | `receptionist@pratikkarate.com` | `staff123` | Student check-in, basic inquiry logging |
| **Academy Staff** | `staff@pratikkarate.com` | `staff123` | Duty punch-in/out, self-attendance |

### 3. Student Portal
- **Role:** Student
- **Email:** `aarav.mehta@demostudent.iss`
- **Password:** `student123`
- **URL:** `http://localhost:3005/student`

---

## Step 9: Run Automated Tests & Quality Checks

The project includes automated test suites to guarantee code stability:

### 9.1 Run All Unit Tests (328 tests)
```bash
npm test
```
*(Runs all unit tests in `tests/Unit/` covering tenant isolation, attendance, payroll, fees, equipment, compliance, and RBAC permissions. Expected: **328 pass, 0 fail**)*

### 9.2 Run Full Role-Based Browser UI Automation (Playwright)
```bash
npm run test:qa:roles
```
*(Launches an automated Chromium browser and verifies all 9 user roles across 33 real UI workflows, saving screenshots to `tests/qa/screenshots/`)*

---

## Troubleshooting & FAQs

### Q1: `Error: listen EADDRINUSE: address already in use :::3005`
- **Cause:** Another process is already running on port 3005.
- **Solution:** Either stop the other process or change `PORT=3006` in your `.env` file.
- On Windows, you can find and kill the process using:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3005).OwningProcess | Stop-Process -Force
  ```

### Q2: I modified code or styling, but the browser shows old cached content
- The server sends `Cache-Control: no-cache` in development mode.
- In your browser, perform a hard refresh:
  - Windows: `Ctrl + Shift + R` or `Ctrl + F5`
  - Mac: `Cmd + Shift + R`

### Q3: How do I reset the database to a fresh state?
- Delete the SQLite database files:
  - `data/central.db`
  - `data/academies/*.db`
- Re-run the initialization commands:
  ```bash
  npm run seed
  npm run migrate
  ```

### Q4: Where are uploaded files and media stored?
- Files are saved locally in the `storage/uploads/` directory.
- Database backups are exported to `storage/backups/`.

---

## 📞 Support & Contacts
If you encounter any issues during setup:
- **Project Lead:** Anil Sir
- **Technical Coordinator:** Pratik
- **Branch:** `node-express-rebuild`

*Happy coding!* 🥋🥋
