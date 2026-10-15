/**
 * International Sports Solutions — Multi-Tenant Vanilla SPA Logic
 */

const app = {
  user: null,
  token: localStorage.getItem('token') || null,
  accessibleAcademies: [],
  selectedAcademyId: localStorage.getItem('selectedAcademyId') || null,
  currentTab: 'overview',
  theme: localStorage.getItem('theme') || 'dark',
  tenantSubdomain: null,

  async init() {
    this.applyTheme();
    this.bindGlobalEvents();

    await this.detectTenantSubdomain();

    if (this.token) {
      await this.checkAuth();
    } else {
      this.showLogin();
    }
  },

  async detectTenantSubdomain() {
    try {
      const res = await this.apiRequest('/api/public/tenant-info');
      if (res && res.success && res.isTenantSubdomain && res.academy) {
        this.tenantSubdomain = res.academy;
        this.selectedAcademyId = res.academy.id;
        document.title = `${res.academy.name} — Sports Academy Portal`;
      }
    } catch (e) {
      console.warn('Subdomain detection check:', e);
    }
  },

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.className = this.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  },

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', this.theme);
    this.applyTheme();
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    const color = type === 'success' ? '#10b981' : (type === 'danger' ? '#ef4444' : '#3b82f6');
    toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color: ${color}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },

  bindGlobalEvents() {
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });
  },

  quickFill(email, password) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
  },

  async apiRequest(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.selectedAcademyId) {
      headers['X-Academy-Id'] = this.selectedAcademyId;
    }

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers,
      });

      if (res.status === 401) {
        this.logout();
        return { success: false, error: 'Session expired' };
      }

      return await res.json();
    } catch (err) {
      console.error('API Request failed:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  async checkAuth() {
    const data = await this.apiRequest('/api/auth/me');
    if (data.success && data.authenticated) {
      this.user = data.user;
      this.accessibleAcademies = data.accessibleAcademies || [];

      if (!this.selectedAcademyId && this.accessibleAcademies.length > 0) {
        this.selectedAcademyId = this.accessibleAcademies[0].id;
        localStorage.setItem('selectedAcademyId', this.selectedAcademyId);
      }

      this.showApp();
    } else {
      this.logout();
    }
  },

  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const submitBtn = document.getElementById('btn-login-submit');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';

    const res = await this.apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    submitBtn.disabled = false;
    submitBtn.innerText = 'Sign In to Portal';

    if (res.success) {
      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('token', res.token);

      if (res.user.academyId) {
        this.selectedAcademyId = res.user.academyId;
        localStorage.setItem('selectedAcademyId', res.user.academyId);
      }

      this.showToast('Logged in successfully', 'success');
      await this.checkAuth();
    } else {
      this.showToast(res.error || 'Login failed', 'danger');
    }
  },

  logout() {
    this.user = null;
    this.token = null;
    this.selectedAcademyId = null;
    localStorage.removeItem('token');
    localStorage.removeItem('selectedAcademyId');
    this.apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.showLogin();
  },

  showLogin() {
    const loginView = document.getElementById('login-view');
    loginView.style.display = 'flex';
    document.getElementById('app-view').style.display = 'none';

    // If on a tenant subdomain, customize branding
    if (this.tenantSubdomain) {
      const headerTitle = loginView.querySelector('h2');
      const headerSub = loginView.querySelector('p');
      if (headerTitle) headerTitle.innerText = this.tenantSubdomain.name;
      if (headerSub) headerSub.innerText = `${this.tenantSubdomain.city || 'Sports Academy'} — Staff & Student Portal`;
    }
  },

  showApp() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';

    // Header info
    document.getElementById('header-user-name').innerText = this.user.name;
    document.getElementById('header-user-role').innerText = this.formatRole(this.user.role);
    document.getElementById('header-user-avatar').innerText = this.user.name.charAt(0).toUpperCase();

    this.renderTenantSelector();
    this.renderSidebar();
    this.navigate(this.user.role === 'student' ? 'student-dashboard' : (this.user.isSuperAdmin ? 'central-academies' : 'overview'));
  },

  formatRole(role) {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'academy_admin') return 'Academy Admin';
    if (role === 'academy_staff') return 'Staff';
    if (role === 'coach') return 'Coach';
    if (role === 'student') return 'Student';
    return role;
  },

  renderTenantSelector() {
    const container = document.getElementById('tenant-selector-container');
    if (this.user.isSuperAdmin && this.accessibleAcademies.length > 0) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 600;">Tenant DB Context:</span>
          <select id="tenant-select-dropdown" class="form-select" onchange="app.switchAcademy(this.value)" style="max-width: 260px;">
            ${this.accessibleAcademies.map(a => `
              <option value="${a.id}" ${a.id == this.selectedAcademyId ? 'selected' : ''}>
                ${a.name} (${a.plan})
              </option>
            `).join('')}
          </select>
        </div>
      `;
    } else if (this.user.academyName) {
      container.innerHTML = `
        <div class="tenant-badge">
          <i class="fa-solid fa-shield-halved"></i>
          <span>${this.user.academyName}</span>
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  },

  switchAcademy(academyId) {
    this.selectedAcademyId = Number(academyId);
    localStorage.setItem('selectedAcademyId', this.selectedAcademyId);
    this.showToast('Switched tenant database context', 'info');
    this.navigate(this.currentTab);
  },

  // ==========================================
  // SIDEBAR NAVIGATION
  // ==========================================

  renderSidebar() {
    const nav = document.getElementById('sidebar-nav-items');
    let html = '';

    if (this.user.isSuperAdmin) {
      html += `
        <div class="nav-section-title">Central SaaS Admin</div>
        <a class="nav-item ${this.currentTab === 'central-academies' ? 'active' : ''}" onclick="app.navigate('central-academies')">
          <i class="fa-solid fa-server"></i> Academies & Databases
        </a>
        <a class="nav-item ${this.currentTab === 'central-stats' ? 'active' : ''}" onclick="app.navigate('central-stats')">
          <i class="fa-solid fa-chart-pie"></i> Platform Metrics
        </a>
        <a class="nav-item ${this.currentTab === 'central-audit' ? 'active' : ''}" onclick="app.navigate('central-audit')">
          <i class="fa-solid fa-list-check"></i> Central Audit Trail
        </a>
      `;
    }

    if (this.user.role !== 'student') {
      html += `
        <div class="nav-section-title">Academy Operations</div>
        <a class="nav-item ${this.currentTab === 'overview' ? 'active' : ''}" onclick="app.navigate('overview')">
          <i class="fa-solid fa-gauge-high"></i> Dashboard
        </a>
        <a class="nav-item ${this.currentTab === 'students' ? 'active' : ''}" onclick="app.navigate('students')">
          <i class="fa-solid fa-users"></i> Students
        </a>
        <a class="nav-item ${this.currentTab === 'coaches' ? 'active' : ''}" onclick="app.navigate('coaches')">
          <i class="fa-solid fa-user-ninja"></i> Coaches & Staff
        </a>
        <a class="nav-item ${this.currentTab === 'batches' ? 'active' : ''}" onclick="app.navigate('batches')">
          <i class="fa-solid fa-calendar-days"></i> Batches & Schedules
        </a>
        <a class="nav-item ${this.currentTab === 'attendance' ? 'active' : ''}" onclick="app.navigate('attendance')">
          <i class="fa-solid fa-clipboard-user"></i> Attendance
        </a>
        <a class="nav-item ${this.currentTab === 'fees' ? 'active' : ''}" onclick="app.navigate('fees')">
          <i class="fa-solid fa-file-invoice-dollar"></i> Fees & Invoices
        </a>
        <a class="nav-item ${this.currentTab === 'leaves' ? 'active' : ''}" onclick="app.navigate('leaves')">
          <i class="fa-solid fa-calendar-check"></i> Leaves
        </a>
        <a class="nav-item ${this.currentTab === 'facilities' ? 'active' : ''}" onclick="app.navigate('facilities')">
          <i class="fa-solid fa-dumbbell"></i> Facilities & Equipment
        </a>
        <a class="nav-item ${this.currentTab === 'audit-logs' ? 'active' : ''}" onclick="app.navigate('audit-logs')">
          <i class="fa-solid fa-shield-halved"></i> Tenant Audit Log
        </a>
      `;
    } else {
      // Student view
      html += `
        <div class="nav-section-title">Student Portal</div>
        <a class="nav-item ${this.currentTab === 'student-dashboard' ? 'active' : ''}" onclick="app.navigate('student-dashboard')">
          <i class="fa-solid fa-gauge-high"></i> My Dashboard
        </a>
        <a class="nav-item ${this.currentTab === 'student-attendance' ? 'active' : ''}" onclick="app.navigate('student-attendance')">
          <i class="fa-solid fa-clipboard-user"></i> Attendance History
        </a>
        <a class="nav-item ${this.currentTab === 'student-fees' ? 'active' : ''}" onclick="app.navigate('student-fees')">
          <i class="fa-solid fa-file-invoice-dollar"></i> My Invoices & Fees
        </a>
      `;
    }

    nav.innerHTML = html;
  },

  navigate(tab) {
    this.currentTab = tab;
    this.renderSidebar();

    const content = document.getElementById('page-content');
    content.innerHTML = '<div style="padding: 40px; text-align: center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

    switch (tab) {
      case 'central-academies':
        this.renderCentralAcademies();
        break;
      case 'central-stats':
        this.renderCentralStats();
        break;
      case 'central-audit':
        this.renderCentralAudit();
        break;
      case 'overview':
        this.renderAcademyOverview();
        break;
      case 'students':
        this.renderStudents();
        break;
      case 'coaches':
        this.renderCoaches();
        break;
      case 'batches':
        this.renderBatches();
        break;
      case 'attendance':
        this.renderAttendance();
        break;
      case 'fees':
        this.renderFees();
        break;
      case 'leaves':
        this.renderLeaves();
        break;
      case 'facilities':
        this.renderFacilities();
        break;
      case 'audit-logs':
        this.renderAuditLogs();
        break;
      case 'student-dashboard':
        this.renderStudentDashboard();
        break;
      case 'student-attendance':
        this.renderStudentAttendance();
        break;
      case 'student-fees':
        this.renderStudentFees();
        break;
      default:
        this.renderAcademyOverview();
    }
  },

  // ==========================================
  // CENTRAL ADMIN VIEWS
  // ==========================================

  async renderCentralAcademies() {
    const data = await this.apiRequest('/api/central/academies');
    const content = document.getElementById('page-content');

    if (!data.success) {
      content.innerHTML = `<div class="toast danger">${data.error}</div>`;
      return;
    }

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <div>
            <h2 class="card-title"><i class="fa-solid fa-server" style="color: var(--primary);"></i> Tenant Databases & Academies</h2>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Each academy is provisioned with a physically isolated SQLite database</p>
          </div>
          <div class="card-actions">
            <a href="/api/central/backup" class="btn btn-secondary btn-sm" download>
              <i class="fa-solid fa-file-zipper"></i> Full Platform ZIP
            </a>
            <button class="btn btn-primary btn-sm" onclick="app.showProvisionAcademyModal()">
              <i class="fa-solid fa-plus"></i> Provision New Academy
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Academy Name & Slug</th>
                <th>Plan & Limits</th>
                <th>Database File</th>
                <th>Live Metrics</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.academies.map(ac => `
                <tr>
                  <td>#${ac.id}</td>
                  <td>
                    <strong>${ac.name}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">Slug: <code>${ac.slug}</code> | ${ac.city || 'India'}</div>
                  </td>
                  <td>
                    <span class="badge badge-info">${ac.plan}</span>
                    <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
                      Max: ${ac.max_students} students, ${ac.max_coaches} coaches
                    </div>
                  </td>
                  <td>
                    <code style="font-size: 11px; background: rgba(255,255,255,0.04); padding: 4px 6px; border-radius: 4px;">
                      academy_${ac.id}.db
                    </code>
                  </td>
                  <td>
                    <div style="font-size: 12px;">
                      <i class="fa-solid fa-user-graduate" style="color: #3b82f6;"></i> ${ac.metrics.students} students &nbsp;|&nbsp;
                      <i class="fa-solid fa-user-ninja" style="color: #10b981;"></i> ${ac.metrics.coaches} coaches
                    </div>
                  </td>
                  <td>
                    <span class="badge ${ac.status === 'active' ? 'badge-success' : 'badge-danger'}">${ac.status}</span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <a href="/api/central/academies/${ac.id}/backup" class="btn btn-secondary btn-sm" title="Download SQLite DB ZIP">
                        <i class="fa-solid fa-download"></i>
                      </a>
                      <button class="btn btn-primary btn-sm" onclick="app.switchAcademy(${ac.id}); app.navigate('overview');" title="Open Academy Dashboard">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  showProvisionAcademyModal() {
    this.openModal(
      'Provision New Academy Database',
      `
        <form id="provision-academy-form">
          <div class="form-grid">
            <div class="form-group">
              <label>Academy Name *</label>
              <input type="text" id="prov-name" class="form-input" style="width: 100%;" required placeholder="e.g. Spartan Sports Club">
            </div>
            <div class="form-group">
              <label>Slug / Subdomain *</label>
              <input type="text" id="prov-slug" class="form-input" style="width: 100%;" required placeholder="spartan-sports">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>City</label>
              <input type="text" id="prov-city" class="form-input" style="width: 100%;" placeholder="Ahmedabad">
            </div>
            <div class="form-group">
              <label>Subscription Plan</label>
              <select id="prov-plan" class="form-select" style="width: 100%;">
                <option value="starter">Starter (100 students)</option>
                <option value="professional" selected>Professional (500 students)</option>
                <option value="enterprise">Enterprise (2000 students)</option>
              </select>
            </div>
          </div>
          <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 8px;">
            <p style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">Initial Academy Administrator Account</p>
            <div class="form-grid">
              <div class="form-group">
                <label>Admin Email *</label>
                <input type="email" id="prov-admin-email" class="form-input" style="width: 100%;" required placeholder="admin@spartansports.com">
              </div>
              <div class="form-group">
                <label>Admin Password *</label>
                <input type="password" id="prov-admin-password" class="form-input" style="width: 100%;" required placeholder="••••••••">
              </div>
            </div>
          </div>
        </form>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitProvisionAcademy()"><i class="fa-solid fa-plus"></i> Create Database & Provision</button>
      `
    );
  },

  async submitProvisionAcademy() {
    const name = document.getElementById('prov-name').value.trim();
    const slug = document.getElementById('prov-slug').value.trim();
    const city = document.getElementById('prov-city').value.trim();
    const plan = document.getElementById('prov-plan').value;
    const admin_email = document.getElementById('prov-admin-email').value.trim();
    const admin_password = document.getElementById('prov-admin-password').value.trim();

    if (!name || !slug || !admin_email || !admin_password) {
      this.showToast('Please fill all required fields', 'danger');
      return;
    }

    const res = await this.apiRequest('/api/central/academies', {
      method: 'POST',
      body: JSON.stringify({ name, slug, city, plan, admin_email, admin_password }),
    });

    if (res.success) {
      this.showToast(res.message, 'success');
      this.closeModal();
      await this.checkAuth();
      this.renderCentralAcademies();
    } else {
      this.showToast(res.error || 'Failed to provision academy', 'danger');
    }
  },

  async renderCentralStats() {
    const data = await this.apiRequest('/api/central/stats');
    const content = document.getElementById('page-content');

    if (!data.success) {
      content.innerHTML = `<div class="toast danger">${data.error}</div>`;
      return;
    }

    const s = data.stats;
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon icon-blue"><i class="fa-solid fa-building"></i></div>
          <div class="stat-details">
            <h3>Total Academies</h3>
            <div class="stat-value">${s.totalAcademies}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-green"><i class="fa-solid fa-user-graduate"></i></div>
          <div class="stat-details">
            <h3>Total Active Students</h3>
            <div class="stat-value">${s.totalStudents}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-purple"><i class="fa-solid fa-user-ninja"></i></div>
          <div class="stat-details">
            <h3>Total Coaches</h3>
            <div class="stat-value">${s.totalCoaches}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-amber"><i class="fa-solid fa-calendar-days"></i></div>
          <div class="stat-details">
            <h3>Total Active Batches</h3>
            <div class="stat-value">${s.totalBatches}</div>
          </div>
        </div>
      </div>
    `;
  },

  async renderCentralAudit() {
    const data = await this.apiRequest('/api/central/audit-logs');
    const content = document.getElementById('page-content');

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-shield-halved"></i> Central Platform Audit Logs</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${(data.logs || []).map(l => `
                <tr>
                  <td>${new Date(l.created_at).toLocaleString()}</td>
                  <td>${l.user_email || 'System'}</td>
                  <td><span class="badge badge-info">${l.action}</span></td>
                  <td>${l.entity}</td>
                  <td>${l.details || '-'}</td>
                  <td><code>${l.ip_address || '-'}</code></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================
  // ACADEMY OPERATIONS VIEWS
  // ==========================================

  async renderAcademyOverview() {
    const data = await this.apiRequest('/api/academy/dashboard');
    const content = document.getElementById('page-content');

    if (!data.success) {
      content.innerHTML = `<div class="toast danger">${data.error}</div>`;
      return;
    }

    const m = data.metrics;
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon icon-blue"><i class="fa-solid fa-user-graduate"></i></div>
          <div class="stat-details">
            <h3>Enrolled Students</h3>
            <div class="stat-value">${m.totalStudents}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-purple"><i class="fa-solid fa-user-ninja"></i></div>
          <div class="stat-details">
            <h3>Active Coaches</h3>
            <div class="stat-value">${m.totalCoaches}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-green"><i class="fa-solid fa-indian-rupee-sign"></i></div>
          <div class="stat-details">
            <h3>Fee Collections</h3>
            <div class="stat-value">₹${m.fees.total_collected.toLocaleString()}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-amber"><i class="fa-solid fa-clock"></i></div>
          <div class="stat-details">
            <h3>Outstanding Fees</h3>
            <div class="stat-value">₹${m.fees.total_outstanding.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
        <div class="content-card">
          <div class="card-header">
            <h2 class="card-title"><i class="fa-solid fa-clipboard-user" style="color: var(--secondary);"></i> Today's Attendance</h2>
            <button class="btn btn-primary btn-sm" onclick="app.navigate('attendance')">Mark Attendance</button>
          </div>
          <div style="padding: 24px; display: flex; align-items: center; justify-content: space-around; text-align: center;">
            <div>
              <div style="font-size: 28px; font-weight: 700; color: #fff;">${m.todayAttendance.marked}</div>
              <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Total Marked</div>
            </div>
            <div>
              <div style="font-size: 28px; font-weight: 700; color: #10b981;">${m.todayAttendance.present}</div>
              <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Present</div>
            </div>
            <div>
              <div style="font-size: 28px; font-weight: 700; color: #ef4444;">${m.todayAttendance.absent}</div>
              <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Absent</div>
            </div>
          </div>
        </div>

        <div class="content-card">
          <div class="card-header">
            <h2 class="card-title"><i class="fa-solid fa-download"></i> Tenant Database Backup</h2>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
              Download a complete standalone ZIP backup of this academy's isolated SQLite database.
            </p>
            <a href="/api/academy/backup" class="btn btn-secondary" style="width: 100%; justify-content: center;" download>
              <i class="fa-solid fa-file-zipper"></i> Download academy_${data.academy.id}.db ZIP
            </a>
          </div>
        </div>
      </div>
    `;
  },

  // STUDENTS
  async renderStudents() {
    const data = await this.apiRequest('/api/academy/students');
    const content = document.getElementById('page-content');

    const students = data.students || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <h2 class="card-title"><i class="fa-solid fa-users"></i> Student Roster (${students.length})</h2>
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="app.exportStudentsExcel()">
              <i class="fa-solid fa-file-excel" style="color: #10b981;"></i> Export Excel (SheetJS)
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.showAddStudentModal()">
              <i class="fa-solid fa-plus"></i> Enroll Student
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="custom-table" id="students-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Student Name</th>
                <th>Guardian & Phone</th>
                <th>Branch</th>
                <th>Enrolled Batches</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => `
                <tr>
                  <td><code>${s.student_code}</code></td>
                  <td>
                    <strong>${s.first_name} ${s.last_name}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${s.email || '-'}</div>
                  </td>
                  <td>
                    ${s.guardian_name || '-'}
                    <div style="font-size: 11px; color: var(--text-muted);">${s.phone || '-'}</div>
                  </td>
                  <td>${s.branch_name || 'Main Campus'}</td>
                  <td><span style="font-size: 12px; color: var(--secondary);">${s.enrolled_batches || 'None'}</span></td>
                  <td><span class="badge badge-success">${s.status}</span></td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="app.showStudentDetails(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                      <i class="fa-solid fa-id-card"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.currentStudentsData = students;
  },

  showAddStudentModal() {
    this.openModal(
      'Enroll New Student',
      `
        <form id="add-student-form">
          <div class="form-grid">
            <div class="form-group">
              <label>First Name *</label>
              <input type="text" id="stu-fn" class="form-input" style="width: 100%;" required>
            </div>
            <div class="form-group">
              <label>Last Name *</label>
              <input type="text" id="stu-ln" class="form-input" style="width: 100%;" required>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="stu-email" class="form-input" style="width: 100%;">
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="text" id="stu-phone" class="form-input" style="width: 100%;">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Guardian Name</label>
              <input type="text" id="stu-guardian" class="form-input" style="width: 100%;">
            </div>
            <div class="form-group">
              <label>Date of Birth</label>
              <input type="date" id="stu-dob" class="form-input" style="width: 100%;">
            </div>
          </div>
        </form>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitAddStudent()"><i class="fa-solid fa-plus"></i> Enroll Student</button>
      `
    );
  },

  async submitAddStudent() {
    const first_name = document.getElementById('stu-fn').value.trim();
    const last_name = document.getElementById('stu-ln').value.trim();
    const email = document.getElementById('stu-email').value.trim();
    const phone = document.getElementById('stu-phone').value.trim();
    const guardian_name = document.getElementById('stu-guardian').value.trim();
    const date_of_birth = document.getElementById('stu-dob').value;

    if (!first_name || !last_name) {
      this.showToast('First and last name are required', 'danger');
      return;
    }

    const res = await this.apiRequest('/api/academy/students', {
      method: 'POST',
      body: JSON.stringify({ first_name, last_name, email, phone, guardian_name, date_of_birth }),
    });

    if (res.success) {
      this.showToast(`Enrolled: ${first_name} ${last_name} (${res.studentCode})`, 'success');
      this.closeModal();
      this.renderStudents();
    } else {
      this.showToast(res.error || 'Failed to enroll student', 'danger');
    }
  },

  exportStudentsExcel() {
    if (!this.currentStudentsData || !this.currentStudentsData.length) {
      this.showToast('No students to export', 'info');
      return;
    }

    const exportRows = this.currentStudentsData.map(s => ({
      'Student Code': s.student_code,
      'First Name': s.first_name,
      'Last Name': s.last_name,
      'Email': s.email || '',
      'Phone': s.phone || '',
      'Guardian Name': s.guardian_name || '',
      'Guardian Phone': s.guardian_phone || '',
      'Branch': s.branch_name || 'Main Campus',
      'Enrolled Batches': s.enrolled_batches || '',
      'Status': s.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, `Students_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.showToast('Excel report generated via SheetJS', 'success');
  },

  // FEES & INVOICES
  async renderFees() {
    const data = await this.apiRequest('/api/academy/fees');
    const content = document.getElementById('page-content');
    const fees = data.fees || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-file-invoice-dollar"></i> Student Invoices & Fee Collections</h2>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="app.exportFeesExcel()">
              <i class="fa-solid fa-file-excel" style="color: #10b981;"></i> Export Excel (SheetJS)
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.showAddInvoiceModal()">
              <i class="fa-solid fa-plus"></i> Generate Invoice
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Student</th>
                <th>Fee Title</th>
                <th>Due Date</th>
                <th>Net Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${fees.map(f => {
                const statusBadge = f.status === 'paid' ? 'badge-success' : (f.status === 'overdue' ? 'badge-danger' : 'badge-warning');
                return `
                  <tr>
                    <td><code>${f.invoice_number}</code></td>
                    <td>
                      <strong>${f.first_name} ${f.last_name}</strong>
                      <div style="font-size: 11px; color: var(--text-muted);">${f.student_code}</div>
                    </td>
                    <td>${f.title}</td>
                    <td>${f.due_date}</td>
                    <td>₹${f.net_amount.toLocaleString()}</td>
                    <td style="color: #10b981; font-weight: 600;">₹${f.paid_amount.toLocaleString()}</td>
                    <td style="color: #f59e0b; font-weight: 600;">₹${f.balance_amount.toLocaleString()}</td>
                    <td><span class="badge ${statusBadge}">${f.status}</span></td>
                    <td>
                      <div style="display: flex; gap: 6px;">
                        ${f.balance_amount > 0 ? `
                          <button class="btn btn-primary btn-sm" onclick="app.showCollectPaymentModal(${f.id}, '${f.invoice_number}', ${f.balance_amount}, '${f.first_name} ${f.last_name}')">
                            <i class="fa-solid fa-hand-holding-dollar"></i> Collect
                          </button>
                        ` : ''}
                        ${f.paid_amount > 0 ? `
                          <button class="btn btn-secondary btn-sm" onclick="app.generateFeeReceiptPdf(${JSON.stringify(f).replace(/"/g, '&quot;')})">
                            <i class="fa-solid fa-file-pdf"></i> Receipt
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.currentFeesData = fees;
  },

  showCollectPaymentModal(invoiceId, invoiceNumber, balance, studentName) {
    this.openModal(
      `Collect Payment — ${invoiceNumber}`,
      `
        <div>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
            Student: <strong>${studentName}</strong> | Outstanding: <strong>₹${balance.toLocaleString()}</strong>
          </p>
          <div class="form-group">
            <label>Amount (₹) *</label>
            <input type="number" id="pay-amt" class="form-input" style="width: 100%;" value="${balance}" max="${balance}" required>
          </div>
          <div class="form-group">
            <label>Payment Mode</label>
            <select id="pay-mode" class="form-select" style="width: 100%;">
              <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer / NEFT</option>
              <option value="card">Card / POS</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div class="form-group">
            <label>Reference / Transaction Note</label>
            <input type="text" id="pay-ref" class="form-input" style="width: 100%;" placeholder="e.g. UPI/20261015/12345">
          </div>
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="app.submitPayment(${invoiceId})"><i class="fa-solid fa-check"></i> Record Payment</button>
      `
    );
  },

  async submitPayment(invoiceId) {
    const amount = Number(document.getElementById('pay-amt').value);
    const payment_mode = document.getElementById('pay-mode').value;
    const transaction_reference = document.getElementById('pay-ref').value.trim();

    if (!amount || amount <= 0) {
      this.showToast('Please enter a valid payment amount', 'danger');
      return;
    }

    const res = await this.apiRequest('/api/academy/fees/pay', {
      method: 'POST',
      body: JSON.stringify({ student_fee_id: invoiceId, amount, payment_mode, transaction_reference }),
    });

    if (res.success) {
      this.showToast(`Payment of ₹${amount} recorded! Receipt: ${res.receiptNumber}`, 'success');
      this.closeModal();
      this.renderFees();
    } else {
      this.showToast(res.error || 'Payment recording failed', 'danger');
    }
  },

  generateFeeReceiptPdf(fee) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text((this.user.academyName || 'Sports Academy').toUpperCase(), 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL FEE PAYMENT RECEIPT', 14, 28);
    doc.text(`DATE: ${new Date().toISOString().split('T')[0]}`, 155, 28);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Student: ${fee.first_name} ${fee.last_name} (${fee.student_code})`, 14, 48);
    doc.text(`Invoice #: ${fee.invoice_number}`, 140, 48);

    doc.autoTable({
      startY: 55,
      head: [['Fee Title', 'Total Net (INR)', 'Paid (INR)', 'Balance (INR)', 'Status']],
      body: [
        [fee.title, `INR ${fee.net_amount.toLocaleString()}`, `INR ${fee.paid_amount.toLocaleString()}`, `INR ${fee.balance_amount.toLocaleString()}`, fee.status.toUpperCase()]
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 6 },
    });

    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Verified electronically by Academy Fee Collection Desk.', 14, finalY);

    doc.save(`Receipt-${fee.invoice_number}.pdf`);
    this.showToast('Letterhead PDF Receipt downloaded via jsPDF', 'success');
  },

  exportFeesExcel() {
    if (!this.currentFeesData || !this.currentFeesData.length) return;
    const rows = this.currentFeesData.map(f => ({
      'Invoice #': f.invoice_number,
      'Student Code': f.student_code,
      'Student Name': `${f.first_name} ${f.last_name}`,
      'Fee Title': f.title,
      'Due Date': f.due_date,
      'Amount': f.net_amount,
      'Paid': f.paid_amount,
      'Balance Due': f.balance_amount,
      'Status': f.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fees');
    XLSX.writeFile(wb, `Fees_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.showToast('Exported fees report via SheetJS', 'success');
  },

  // ATTENDANCE
  async renderAttendance() {
    const batchesData = await this.apiRequest('/api/academy/batches');
    const batches = batchesData.batches || [];
    const today = new Date().toISOString().split('T')[0];
    const content = document.getElementById('page-content');

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-clipboard-user"></i> Batch Attendance Marking</h2>
        </div>
        <div style="padding: 20px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.01);">
          <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;">
            <div class="form-group" style="margin: 0; min-width: 220px;">
              <label>Select Training Batch</label>
              <select id="att-batch-select" class="form-select" style="width: 100%;">
                ${batches.map(b => `<option value="${b.id}">${b.name} (${b.sport_name})</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label>Date</label>
              <input type="date" id="att-date-input" class="form-input" value="${today}">
            </div>
            <button class="btn btn-primary" onclick="app.loadAttendanceRoster()">
              <i class="fa-solid fa-magnifying-glass"></i> Load Roster
            </button>
          </div>
        </div>
        <div id="attendance-roster-container" style="padding: 20px;">
          <p style="color: var(--text-muted); font-size: 13px;">Select a batch and date above to load student attendance.</p>
        </div>
      </div>
    `;

    if (batches.length > 0) {
      this.loadAttendanceRoster();
    }
  },

  async loadAttendanceRoster() {
    const batchId = document.getElementById('att-batch-select').value;
    const date = document.getElementById('att-date-input').value;
    const container = document.getElementById('attendance-roster-container');

    container.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading roster...';

    const res = await this.apiRequest(`/api/academy/attendance?batch_id=${batchId}&date=${date}`);
    if (!res.success) {
      container.innerHTML = `<div class="toast danger">${res.error}</div>`;
      return;
    }

    const roster = res.roster || [];
    if (!roster.length) {
      container.innerHTML = '<p style="color: var(--text-muted);">No students are currently enrolled in this batch.</p>';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 13px; font-weight: 600;">Enrolled Students (${roster.length})</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="app.setAllAttendance('present')">All Present</button>
          <button class="btn btn-secondary btn-sm" onclick="app.setAllAttendance('absent')">All Absent</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Student</th>
              <th>Attendance Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${roster.map(r => `
              <tr data-student-id="${r.student_id}">
                <td><code>${r.student_code}</code></td>
                <td><strong>${r.first_name} ${r.last_name}</strong></td>
                <td>
                  <select class="form-select att-status-select" style="padding: 4px 8px; font-size: 12px;">
                    <option value="present" ${r.status === 'present' ? 'selected' : ''}>Present</option>
                    <option value="absent" ${r.status === 'absent' ? 'selected' : ''}>Absent</option>
                    <option value="late" ${r.status === 'late' ? 'selected' : ''}>Late</option>
                    <option value="excused" ${r.status === 'excused' ? 'selected' : ''}>Excused</option>
                  </select>
                </td>
                <td>
                  <input type="text" class="form-input att-remark-input" style="padding: 4px 8px; font-size: 12px; width: 100%; max-width: 250px;" value="${r.remarks || ''}" placeholder="Optional remark">
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <button class="btn btn-success" onclick="app.saveAttendance(${batchId}, '${date}')">
          <i class="fa-solid fa-floppy-disk"></i> Save Attendance
        </button>
      </div>
    `;
  },

  setAllAttendance(status) {
    document.querySelectorAll('.att-status-select').forEach(sel => sel.value = status);
  },

  async saveAttendance(batchId, date) {
    const rows = document.querySelectorAll('#attendance-roster-container tbody tr');
    const entries = [];

    rows.forEach(row => {
      const student_id = row.getAttribute('data-student-id');
      const status = row.querySelector('.att-status-select').value;
      const remarks = row.querySelector('.att-remark-input').value.trim();
      entries.push({ student_id, status, remarks });
    });

    const res = await this.apiRequest('/api/academy/attendance', {
      method: 'POST',
      body: JSON.stringify({ batch_id: batchId, date, entries }),
    });

    if (res.success) {
      this.showToast(res.message, 'success');
    } else {
      this.showToast(res.error || 'Failed to save attendance', 'danger');
    }
  },

  // COACHES
  async renderCoaches() {
    const data = await this.apiRequest('/api/academy/coaches');
    const content = document.getElementById('page-content');
    const coaches = data.coaches || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-user-ninja"></i> Coaching & Staff Team (${coaches.length})</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Coach Name</th>
                <th>Sport</th>
                <th>Branch</th>
                <th>Experience & Specialization</th>
                <th>Active Batches</th>
                <th>Salary</th>
              </tr>
            </thead>
            <tbody>
              ${coaches.map(c => `
                <tr>
                  <td>
                    <strong>${c.name}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${c.email || c.phone || '-'}</div>
                  </td>
                  <td><span class="badge badge-info">${c.sport_name || 'General'}</span></td>
                  <td>${c.branch_name || 'Main Campus'}</td>
                  <td>
                    <div style="font-size: 12px;">${c.experience_years} years exp.</div>
                    <div style="font-size: 11px; color: var(--text-dim);">${c.specializations || '-'}</div>
                  </td>
                  <td>${c.active_batches} batches</td>
                  <td>₹${c.salary_amount.toLocaleString()} / ${c.salary_type}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // BATCHES
  async renderBatches() {
    const data = await this.apiRequest('/api/academy/batches');
    const content = document.getElementById('page-content');
    const batches = data.batches || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-calendar-days"></i> Training Batches & Schedules (${batches.length})</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Batch Name</th>
                <th>Sport</th>
                <th>Coach</th>
                <th>Timing & Schedule</th>
                <th>Capacity</th>
                <th>Monthly Fee</th>
              </tr>
            </thead>
            <tbody>
              ${batches.map(b => `
                <tr>
                  <td><strong>${b.name}</strong></td>
                  <td><span class="badge badge-info">${b.sport_name}</span></td>
                  <td>${b.coach_name || 'Assigned Coach'}</td>
                  <td>
                    <div style="font-size: 12px; font-weight: 600;">${b.start_time} - ${b.end_time}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${b.days_of_week}</div>
                  </td>
                  <td>${b.enrolled_count} / ${b.max_capacity}</td>
                  <td>₹${b.monthly_fee.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // LEAVES
  async renderLeaves() {
    const data = await this.apiRequest('/api/academy/leaves');
    const content = document.getElementById('page-content');
    const leaves = data.leaves || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-calendar-check"></i> Leave Requests</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${leaves.map(l => `
                <tr>
                  <td><strong>${l.applicant_name}</strong></td>
                  <td><span class="badge badge-info">${l.applicant_type}</span></td>
                  <td>${l.start_date} to ${l.end_date}</td>
                  <td>${l.reason}</td>
                  <td>
                    <span class="badge ${l.status === 'approved' ? 'badge-success' : (l.status === 'rejected' ? 'badge-danger' : 'badge-warning')}">
                      ${l.status}
                    </span>
                  </td>
                  <td>
                    ${l.status === 'pending' ? `
                      <button class="btn btn-success btn-sm" onclick="app.updateLeave(${l.id}, 'approved')">Approve</button>
                      <button class="btn btn-danger btn-sm" onclick="app.updateLeave(${l.id}, 'rejected')">Reject</button>
                    ` : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async updateLeave(id, status) {
    const res = await this.apiRequest(`/api/academy/leaves/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (res.success) {
      this.showToast(res.message, 'success');
      this.renderLeaves();
    }
  },

  // FACILITIES & INVENTORY
  async renderFacilities() {
    const facData = await this.apiRequest('/api/academy/facilities');
    const invData = await this.apiRequest('/api/academy/inventory');
    const content = document.getElementById('page-content');

    const facilities = facData.facilities || [];
    const inventory = invData.items || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-building-columns"></i> Sports Facilities & Courts</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Facility Name</th>
                <th>Type</th>
                <th>Branch</th>
                <th>Capacity</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              ${facilities.map(f => `
                <tr>
                  <td><strong>${f.name}</strong></td>
                  <td><span class="badge badge-info">${f.type}</span></td>
                  <td>${f.branch_name || 'Main Campus'}</td>
                  <td>${f.capacity} persons</td>
                  <td><span class="badge badge-success">Available</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-boxes-stacked"></i> Equipment Inventory</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Equipment Name</th>
                <th>Sport</th>
                <th>Branch</th>
                <th>Quantity</th>
                <th>Condition</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              ${inventory.map(i => `
                <tr>
                  <td><strong>${i.name}</strong></td>
                  <td>${i.sport_name || 'General'}</td>
                  <td>${i.branch_name || 'Main Campus'}</td>
                  <td><strong>${i.quantity}</strong> units</td>
                  <td><span class="badge badge-success">${i.condition}</span></td>
                  <td>${i.location || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // AUDIT LOGS
  async renderAuditLogs() {
    const data = await this.apiRequest('/api/academy/audit-logs');
    const content = document.getElementById('page-content');
    const logs = data.logs || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-shield-halved"></i> Isolated Tenant Audit Trail</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td>${new Date(l.created_at).toLocaleString()}</td>
                  <td>${l.user_name || 'Staff'}</td>
                  <td><span class="badge badge-info">${l.user_role}</span></td>
                  <td><span class="badge badge-success">${l.action}</span></td>
                  <td>${l.entity}</td>
                  <td>${l.details || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================
  // STUDENT PORTAL VIEWS
  // ==========================================

  async renderStudentDashboard() {
    const data = await this.apiRequest('/api/student/dashboard');
    const content = document.getElementById('page-content');

    if (!data.success) {
      content.innerHTML = `<div class="toast danger">${data.error}</div>`;
      return;
    }

    const { student, batches, attendance, fees } = data;

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon icon-blue"><i class="fa-solid fa-clipboard-check"></i></div>
          <div class="stat-details">
            <h3>Attendance Rate</h3>
            <div class="stat-value">${attendance.percentage}%</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-green"><i class="fa-solid fa-calendar-check"></i></div>
          <div class="stat-details">
            <h3>Sessions Attended</h3>
            <div class="stat-value">${attendance.present} / ${attendance.totalSessions}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-amber"><i class="fa-solid fa-wallet"></i></div>
          <div class="stat-details">
            <h3>Outstanding Fees</h3>
            <div class="stat-value">₹${fees.outstanding_balance.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-calendar-days"></i> My Enrolled Training Batches</h2>
        </div>
        <div style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          ${batches.map(b => `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px;">
              <span class="badge badge-info">${b.sport_name}</span>
              <h3 style="font-size: 16px; font-weight: 600; color: #fff; margin: 8px 0;">${b.name}</h3>
              <p style="font-size: 13px; color: var(--text-muted);">
                <i class="fa-solid fa-clock"></i> ${b.start_time} - ${b.end_time} (${b.days_of_week})
              </p>
              <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                <i class="fa-solid fa-user-ninja"></i> Coach: <strong>${b.coach_name || 'Head Coach'}</strong>
              </p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  async renderStudentAttendance() {
    const data = await this.apiRequest('/api/student/attendance');
    const content = document.getElementById('page-content');
    const records = data.records || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-clipboard-user"></i> My Attendance History</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Training Batch</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td><strong>${r.date}</strong></td>
                  <td>${r.batch_name}</td>
                  <td>
                    <span class="badge ${r.status === 'present' ? 'badge-success' : 'badge-danger'}">
                      ${r.status}
                    </span>
                  </td>
                  <td>${r.remarks || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async renderStudentFees() {
    const data = await this.apiRequest('/api/student/fees');
    const content = document.getElementById('page-content');
    const invoices = data.invoices || [];

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title"><i class="fa-solid fa-file-invoice-dollar"></i> My Invoices & Payment History</h2>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Title</th>
                <th>Due Date</th>
                <th>Net Total</th>
                <th>Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => `
                <tr>
                  <td><code>${inv.invoice_number}</code></td>
                  <td><strong>${inv.title}</strong></td>
                  <td>${inv.due_date}</td>
                  <td>₹${inv.net_amount.toLocaleString()}</td>
                  <td style="color: #10b981; font-weight: 600;">₹${inv.paid_amount.toLocaleString()}</td>
                  <td style="color: #f59e0b; font-weight: 600;">₹${inv.balance_amount.toLocaleString()}</td>
                  <td>
                    <span class="badge ${inv.status === 'paid' ? 'badge-success' : 'badge-warning'}">
                      ${inv.status}
                    </span>
                  </td>
                  <td>
                    ${inv.balance_amount > 0 ? `
                      <button class="btn btn-primary btn-sm" onclick="app.payStudentFeeOnline(${inv.id}, ${inv.balance_amount}, '${inv.invoice_number}')">
                        <i class="fa-solid fa-credit-card"></i> Pay Online
                      </button>
                    ` : `
                      <button class="btn btn-secondary btn-sm" onclick="app.generateFeeReceiptPdf(${JSON.stringify(inv).replace(/"/g, '&quot;')})">
                        <i class="fa-solid fa-file-pdf"></i> Receipt
                      </button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async payStudentFeeOnline(invoiceId, balance, invoiceNumber) {
    if (!confirm(`Confirm online payment of ₹${balance.toLocaleString()} for Invoice ${invoiceNumber}?`)) {
      return;
    }

    const res = await this.apiRequest('/api/student/pay', {
      method: 'POST',
      body: JSON.stringify({ student_fee_id: invoiceId, amount: balance }),
    });

    if (res.success) {
      this.showToast(`Payment successful! Receipt #${res.receiptNumber}`, 'success');
      this.renderStudentFees();
    } else {
      this.showToast(res.error || 'Payment failed', 'danger');
    }
  },

  // ==========================================
  // MODAL UTILITIES
  // ==========================================

  openModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-container').classList.add('active');
  },

  closeModal() {
    document.getElementById('modal-container').classList.remove('active');
  },
};

document.addEventListener('DOMContentLoaded', () => app.init());
