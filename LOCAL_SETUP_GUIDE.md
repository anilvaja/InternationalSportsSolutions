# 🚀 Complete Local & GitHub Setup Guide
## International Sports Solutions — Multi-Tenant Sports SaaS

Welcome to the **International Sports Solutions** project!  
This guide is designed for beginners and new teammates. It covers everything from setting up your **GitHub account** and cloning the repository to installing **Node.js**, running database migrations, setting up local domains, and launching the application.

> [!NOTE]
> **No PHP, Composer, MySQL, or Apache/Nginx required!**  
> The application is 100% pure Node.js + Express. The database uses embedded SQLite (`better-sqlite3`), meaning the database files are stored right inside the project folder (`data/`). You do not need to install or configure any external database server.

---

## 📋 Table of Contents
1. [Required Softwares & Tools](#1-required-softwares--tools)
2. [GitHub Setup & Repository Access](#2-github-setup--repository-access)
3. [Step 1: Download / Clone the Repository from GitHub](#step-1-download--clone-the-repository-from-github)
   - [Method A: Using GitHub Desktop (Easiest for Beginners)](#method-a-using-github-desktop-easiest-for-beginners)
   - [Method B: Using Git Command Line / VS Code](#method-b-using-git-command-line--vs-code)
4. [Step 2: Environment Configuration (.env)](#step-2-environment-configuration-env)
5. [Step 3: Install Node.js Dependencies](#step-3-install-nodejs-dependencies)
6. [Step 4: Initialize Database & Run Migrations](#step-4-initialize-database--run-migrations)
7. [Step 5: Local Domain Setup (Optional / Recommended)](#step-5-local-domain-setup-optional--recommended)
8. [Step 6: Start the Application Server](#step-6-start-the-application-server)
9. [Step 7: How to Open & Navigate Every Panel](#step-7-how-to-open--navigate-every-panel)
10. [Step 8: Demo Accounts & Login Credentials](#step-8-demo-accounts--login-credentials)
11. [Step 9: Daily Git Workflow (Pulling, Branching, Committing & Pushing)](#step-9-daily-git-workflow-pulling-branching-committing--pushing)
12. [Step 10: Run Automated Tests & Quality Checks](#step-10-run-automated-tests--quality-checks)
13. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## 1. Required Softwares & Tools

Before you begin, install the following free tools on your computer:

### 1.1 GitHub Account
- **What it is:** Your profile on GitHub to access the code repository.
- **Sign Up Link:** [https://github.com/signup](https://github.com/signup)
- Create a free account using your work or personal email address.

### 1.2 Git (Version Control)
- **What it is:** The underlying tool used to download and sync code from GitHub.
- **Download Link:** [https://git-scm.com/downloads](https://git-scm.com/downloads)
- **Installation:** Download the installer for Windows/macOS and complete the setup using default options.
- **Verification:** Open your terminal (PowerShell or Command Prompt) and type:
  ```bash
  git --version
  ```
  *(You should see `git version 2.40.0` or higher)*

### 1.3 GitHub Desktop (Optional, but highly recommended for beginners!)
- **What it is:** A clean visual application that lets you clone, commit, pull, and push with mouse clicks—no command line needed!
- **Download Link:** [https://desktop.github.com/](https://desktop.github.com/)

### 1.4 Node.js (JavaScript Runtime Engine)
- **What it is:** The runtime engine that powers our backend Express application.
- **Download Link:** [https://nodejs.org/](https://nodejs.org/)
- **Recommended Version:** **Node.js 20 LTS** or **Node.js 22 LTS**.
- **Installation:** Download the **LTS (Long Term Support)** installer and run it. Accept all defaults.
- **Verification:** Open your terminal and check both Node and NPM:
  ```bash
  node -v
  npm -v
  ```
  *(Expected: `v20.x.x` or higher for Node, and `10.x.x` or higher for npm)*

### 1.5 Code Editor: Visual Studio Code
- **Download Link:** [https://code.visualstudio.com/](https://code.visualstudio.com/)
- Recommended extensions (search inside VS Code Extensions tab `Ctrl + Shift + X`):
  - *ESLint*
  - *Prettier - Code formatter*
  - *SQLite Viewer* (allows you to view `.db` tables directly in VS Code)

### 1.6 Web Browser
- Google Chrome, Microsoft Edge, or Mozilla Firefox.

---

## 2. GitHub Setup & Repository Access

### 2.1 Request Collaborator Access
The repository is located at:  
👉 **[https://github.com/anilvaja/InternationalSportsSolutions](https://github.com/anilvaja/InternationalSportsSolutions)**

If the repository is private:
1. Send your **GitHub username** or **email** to Anil Sir or Pratik.
2. They will invite you as a collaborator.
3. Check your email or visit [https://github.com/anilvaja/InternationalSportsSolutions/invitations](https://github.com/anilvaja/InternationalSportsSolutions/invitations) to **Accept the Invitation**.

### 2.2 Configure Git with Your Name and Email
Open your terminal (PowerShell or Git Bash) and tell Git who you are (used for commit authoring):
```bash
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"
```

---

## Step 1: Download / Clone the Repository from GitHub

Choose **Method A** (Visual / Beginner-friendly) or **Method B** (Command line).

### Method A: Using GitHub Desktop (Easiest for Beginners)

1. Open **GitHub Desktop** on your computer.
2. Sign in to your GitHub account:  
   *File → Options → Accounts → Sign in*.
3. Click **File → Clone Repository...**
4. Select the **URL** tab and paste:
   ```text
   https://github.com/anilvaja/InternationalSportsSolutions.git
   ```
5. Choose a folder on your computer where the code will be saved (e.g. `C:\Projects\InternationalSportsSolutions`).
6. Click **Clone**.
7. Once cloned, look at the top toolbar in GitHub Desktop under **Current Branch**:
   - Click the branch dropdown.
   - Select **`node-express-rebuild`**.
8. Click **Fetch origin** / **Pull origin** to ensure you have the newest code!

---

### Method B: Using Git Command Line / VS Code

1. Open **PowerShell** or **Terminal**.
2. Navigate to your desired working directory (e.g. `C:\Projects`):
   ```bash
   cd C:\Projects
   ```
3. Clone the repository:
   ```bash
   git clone https://github.com/anilvaja/InternationalSportsSolutions.git
   ```
4. Enter the cloned project folder:
   ```bash
   cd InternationalSportsSolutions
   ```
5. **Switch to the active Node.js rebuild branch (`node-express-rebuild`)**:
   ```bash
   git checkout node-express-rebuild
   ```
6. Pull the latest code updates:
   ```bash
   git pull origin node-express-rebuild
   ```
7. Open the folder in VS Code:
   ```bash
   code .
   ```

---

## Step 2: Environment Configuration (`.env`)

The project uses a configuration file named `.env` in the root folder.

1. Create your local `.env` file from the provided example:
   - **On Windows (PowerShell):**
     ```powershell
     Copy-Item .env.example .env
     ```
   - **On macOS / Linux / Git Bash:**
     ```bash
     cp .env.example .env
     ```
   - **Or in VS Code:** Right-click `.env.example`, choose **Copy**, right-click in empty space, choose **Paste**, and rename it to `.env`.

2. The default settings in `.env` are ready for immediate local development:
   ```env
   PORT=3005
   NODE_ENV=development
   JWT_SECRET=iss_sports_saas_super_secret_jwt_key_2026
   JWT_EXPIRES_IN=7d
   APP_URL=http://localhost:3005
   BASE_DOMAIN=internationalsportssolutions.test
   ```
   *(No changes needed!)*

---

## Step 3: Install Node.js Dependencies

Open your terminal inside the project folder (or in VS Code, open the built-in terminal by pressing `Ctrl + ~` or `Cmd + ~`) and run:

```bash
npm install
```

> [!TIP]
> This installs Express, SQLite (`better-sqlite3`), JWT authentication, bcrypt, multer, sharp, and testing libraries. It usually completes in 30–60 seconds.

---

## Step 4: Initialize Database & Run Migrations

The application uses an isolated **Physical Database-Per-Tenant** SQLite architecture:
- `data/central.db` → Central database for SaaS subscription plans, academies, and super admins.
- `data/academies/academy_1.db` → Dedicated tenant database for **Pratik Karate Academy**.

### 4.1 Seed Initial Demo Data
Run the seeder to populate default academy branches, belts, syllabus, batches, and coach accounts:
```bash
npm run seed
```
*(Expected output: `✔ Central database seeded successfully` and `✔ Default tenant Pratik Karate Academy initialized`)*

### 4.2 Apply Database Schema Migrations
Run the database migrator to apply all schema updates (migrations `001` through `029`):
```bash
npm run migrate
```
*(Expected output: `[Migration] Applied migration: 001_initial_schema.sql` ... `029_organization_documents_and_compliance.sql`)*

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
   - **Windows:** Search for **Notepad** in the Start Menu → Right-click and choose **Run as Administrator** → Open `C:\Windows\System32\drivers\etc\hosts` (set file filter to *All Files `*.*`*).
   - **macOS / Linux:** Open terminal and run: `sudo nano /etc/hosts`
2. Add these two lines at the bottom of the file:
   ```text
   127.0.0.1 internationalsportssolutions.test
   127.0.0.1 pratik-karate.internationalsportssolutions.test
   ```
3. Save the file.

---

## Step 6: Start the Application Server

Start the local server using npm in your terminal:

### Production Mode:
```bash
npm start
```

### Or Development Mode (Auto-restarts when you make code changes):
```bash
npm run server:dev
```

You should see this startup banner in your terminal:
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
> Keep this terminal open while using the application. To stop the server at any time, press `Ctrl + C`.

---

## Step 7: How to Open & Navigate Every Panel

Open your browser (Chrome/Edge) and navigate to the portal you wish to test:

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

## Step 9: Daily Git Workflow (Pulling, Branching, Committing & Pushing)

When working as part of the team, follow this simple daily routine:

### 1. Start of Day: Pull New Changes from GitHub
Before writing any new code, always get the latest team updates:
- **In GitHub Desktop:** Click **Fetch origin**, then click **Pull origin**.
- **In Command Line:**
  ```bash
  git checkout node-express-rebuild
  git pull origin node-express-rebuild
  ```

### 2. Making Changes & Committing
Once you have written or tested your code:
- **In GitHub Desktop:**
  1. Look at the left sidebar showing your changed files.
  2. Write a short summary in the "Summary" box (e.g. `fix: update fee receipt print layout`).
  3. Click **Commit to node-express-rebuild**.
  4. Click **Push origin** at the top.
- **In Command Line:**
  ```bash
  # Check which files you changed
  git status

  # Stage all your changes
  git add .

  # Commit with a clear descriptive message
  git commit -m "feat: your feature description"

  # Push to GitHub
  git push origin node-express-rebuild
  ```

---

## Step 10: Run Automated Tests & Quality Checks

Before pushing any changes to GitHub, make sure existing features still work:

### 10.1 Run All 328 Unit Tests
```bash
npm test
```
*(Runs all unit tests in `tests/Unit/` covering tenant isolation, attendance, payroll, fees, equipment, compliance, and RBAC permissions. Expected: **328 pass, 0 fail**)*

### 10.2 Run Full Role-Based Browser UI Automation (Playwright)
```bash
npm run test:qa:roles
```
*(Launches an automated Chromium browser and verifies all 9 user roles across 33 real UI workflows, saving screenshots to `tests/qa/screenshots/`)*

---

## Troubleshooting & FAQs

### Q1: `Error: listen EADDRINUSE: address already in use :::3005`
- **Cause:** Another process is already running on port 3005.
- **Solution:** Either stop the other process or change `PORT=3006` in your `.env` file.
- On Windows, you can find and kill the process using PowerShell:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3005).OwningProcess | Stop-Process -Force
  ```

### Q2: Git asks for credentials when cloning or pushing (`Password for 'https://...'`)
- GitHub no longer accepts account passwords on the command line.
- **Solution:** When prompted, select **Sign in with your browser** (Git Credential Manager will open a browser tab to log in).
- Alternatively, use **GitHub Desktop**, which manages authentication automatically.

### Q3: How do I reset the database to a fresh state?
- Delete the SQLite database files:
  - `data/central.db`
  - `data/academies/*.db`
- Re-run the initialization commands:
  ```bash
  npm run seed
  npm run migrate
  ```

### Q4: I modified code or styling, but the browser shows old cached content
- The server sends `Cache-Control: no-cache` in development mode.
- In your browser, perform a hard refresh:
  - Windows: `Ctrl + Shift + R` or `Ctrl + F5`
  - Mac: `Cmd + Shift + R`

---

## 📞 Support & Contacts
If you encounter any issues during setup or need assistance:
- **Project Lead:** Anil Sir
- **Technical Coordinator:** Pratik
- **Branch:** `node-express-rebuild`

*Happy coding!* 🥋🥋
