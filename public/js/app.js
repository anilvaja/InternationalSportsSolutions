/**
 * International Sports Solutions — Multi-Tenant Vanilla SPA Logic
 */

const app = {
  user: null,
  token: localStorage.getItem('token') || null,
  accessibleAcademies: [],
  selectedAcademyId: localStorage.getItem('selectedAcademyId') || null,
  currentTab: 'overview',
  theme: localStorage.getItem('theme') || 'light',
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

    window.addEventListener('popstate', (e) => {
      if (!this.user) return;
      const tab = (e.state && e.state.tab) || this.getTabForPath(window.location.pathname) || this.getDefaultTab();
      this.navigate(tab, false);
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
    if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
      window.history.pushState(null, '', '/login');
    }
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

    const urlTab = this.getTabForPath(window.location.pathname);
    const targetTab = (urlTab && this.isTabAllowed(urlTab)) ? urlTab : this.getDefaultTab();
    this.navigate(targetTab, true);
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
    this.navigate(this.currentTab, false);
  },

  // ==========================================
  // URL ROUTING & NAVIGATION
  // ==========================================

  routes: {
    // Central SaaS Admin
    'central-academies': '/admin/academies',
    'central-stats': '/admin/analytics',
    'central-audit': '/admin/audit',

    // Academy Operations
    'overview': '/academy/overview',
    'students': '/academy/students',
    'coaches': '/academy/coaches',
    'batches': '/academy/batches',
    'attendance': '/academy/attendance',
    'syllabus': '/academy/syllabus',
    'fees': '/academy/fees',
    'leaves': '/academy/leaves',
    'facilities': '/academy/facilities',
    'audit-logs': '/academy/audit-logs',

    // Student Portal
    'student-dashboard': '/student/dashboard',
    'student-technique': '/student/syllabus',
    'student-attendance': '/student/attendance',
    'student-fees': '/student/fees',
  },

  tabTitles: {
    'central-academies': 'Academies & Databases',
    'central-stats': 'Platform Metrics',
    'central-audit': 'Central Audit Trail',
    'overview': 'Dashboard',
    'students': 'Students',
    'coaches': 'Coaches & Staff',
    'batches': 'Batches & Schedules',
    'attendance': 'Attendance',
    'syllabus': 'Sports Syllabus & Learning Progression',
    'fees': 'Fees & Invoices',
    'leaves': 'Leaves',
    'facilities': 'Facilities & Equipment',
    'audit-logs': 'Tenant Audit Log',
    'student-dashboard': 'Student Dashboard',
    'student-technique': 'My Syllabus Progress',
    'student-attendance': 'Attendance History',
    'student-fees': 'My Invoices & Fees',
  },

  getPathForTab(tab) {
    return this.routes[tab] || '/academy/overview';
  },

  getTabForPath(pathname) {
    if (!pathname) return null;
    const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';

    for (const [tab, route] of Object.entries(this.routes)) {
      if (route.toLowerCase() === clean) return tab;
    }

    const aliases = {
      '/admin': 'central-academies',
      '/admin/academies': 'central-academies',
      '/admin/dashboard': 'central-academies',
      '/admin/stats': 'central-stats',
      '/admin/analytics': 'central-stats',
      '/admin/metrics': 'central-stats',
      '/admin/audit': 'central-audit',
      '/academy': 'overview',
      '/academy/overview': 'overview',
      '/academy/dashboard': 'overview',
      '/academy/students': 'students',
      '/academy/coaches': 'coaches',
      '/academy/batches': 'batches',
      '/academy/attendance': 'attendance',
      '/academy/syllabus': 'syllabus',
      '/academy/techniques': 'syllabus',
      '/academy/fees': 'fees',
      '/academy/leaves': 'leaves',
      '/academy/facilities': 'facilities',
      '/academy/audit-logs': 'audit-logs',
      '/student': 'student-dashboard',
      '/student/dashboard': 'student-dashboard',
      '/student/technique': 'student-technique',
      '/student/techniques': 'student-technique',
      '/student/syllabus': 'student-technique',
      '/student/attendance': 'student-attendance',
      '/student/fees': 'student-fees',
    };

    return aliases[clean] || null;
  },

  isTabAllowed(tab) {
    if (!this.user) return false;
    if (this.user.role === 'student') {
      return ['student-dashboard', 'student-technique', 'student-attendance', 'student-fees'].includes(tab);
    }
    const academyTabs = ['overview', 'students', 'coaches', 'batches', 'attendance', 'syllabus', 'fees', 'leaves', 'facilities', 'audit-logs'];
    if (academyTabs.includes(tab)) return true;
    if (this.user.isSuperAdmin) {
      return ['central-academies', 'central-stats', 'central-audit'].includes(tab);
    }
    return false;
  },

  getDefaultTab() {
    if (!this.user) return 'overview';
    if (this.user.role === 'student') return 'student-dashboard';
    if (this.user.isSuperAdmin) return 'central-academies';
    return 'overview';
  },

  updateDocumentTitle(tab) {
    const academyName = (this.user && this.user.academyName) || (this.tenantSubdomain && this.tenantSubdomain.name) || 'International Sports Solutions';
    const tabTitle = this.tabTitles[tab] || 'Portal';
    document.title = `${tabTitle} — ${academyName}`;
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
        <a href="${this.getPathForTab('central-academies')}" class="nav-item ${this.currentTab === 'central-academies' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('central-academies')">
          <i class="fa-solid fa-server"></i> Academies & Databases
        </a>
        <a href="${this.getPathForTab('central-stats')}" class="nav-item ${this.currentTab === 'central-stats' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('central-stats')">
          <i class="fa-solid fa-chart-pie"></i> Platform Metrics
        </a>
        <a href="${this.getPathForTab('central-audit')}" class="nav-item ${this.currentTab === 'central-audit' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('central-audit')">
          <i class="fa-solid fa-list-check"></i> Central Audit Trail
        </a>
      `;
    }

    if (this.user.role !== 'student') {
      html += `
        <div class="nav-section-title">Academy Operations</div>
        <a href="${this.getPathForTab('overview')}" class="nav-item ${this.currentTab === 'overview' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('overview')">
          <i class="fa-solid fa-gauge-high"></i> Dashboard
        </a>
        <a href="${this.getPathForTab('students')}" class="nav-item ${this.currentTab === 'students' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('students')">
          <i class="fa-solid fa-users"></i> Students
        </a>
        <a href="${this.getPathForTab('coaches')}" class="nav-item ${this.currentTab === 'coaches' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('coaches')">
          <i class="fa-solid fa-user-ninja"></i> Coaches & Staff
        </a>
        <a href="${this.getPathForTab('batches')}" class="nav-item ${this.currentTab === 'batches' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('batches')">
          <i class="fa-solid fa-calendar-days"></i> Batches & Schedules
        </a>
        <a href="${this.getPathForTab('attendance')}" class="nav-item ${this.currentTab === 'attendance' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('attendance')">
          <i class="fa-solid fa-clipboard-user"></i> Attendance
        </a>
        <a href="${this.getPathForTab('syllabus')}" class="nav-item ${this.currentTab === 'syllabus' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('syllabus')">
          <i class="fa-solid fa-graduation-cap"></i> Sports Syllabus
        </a>
        <a href="${this.getPathForTab('fees')}" class="nav-item ${this.currentTab === 'fees' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('fees')">
          <i class="fa-solid fa-file-invoice-dollar"></i> Fees & Invoices
        </a>
        <a href="${this.getPathForTab('leaves')}" class="nav-item ${this.currentTab === 'leaves' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('leaves')">
          <i class="fa-solid fa-calendar-check"></i> Leaves
        </a>
        <a href="${this.getPathForTab('facilities')}" class="nav-item ${this.currentTab === 'facilities' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('facilities')">
          <i class="fa-solid fa-dumbbell"></i> Facilities & Equipment
        </a>
        <a href="${this.getPathForTab('audit-logs')}" class="nav-item ${this.currentTab === 'audit-logs' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('audit-logs')">
          <i class="fa-solid fa-shield-halved"></i> Tenant Audit Log
        </a>
      `;
    } else {
      // Student view
      html += `
        <div class="nav-section-title">Student Portal</div>
        <a href="${this.getPathForTab('student-dashboard')}" class="nav-item ${this.currentTab === 'student-dashboard' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('student-dashboard')">
          <i class="fa-solid fa-gauge-high"></i> My Dashboard
        </a>
        <a href="${this.getPathForTab('student-technique')}" class="nav-item ${this.currentTab === 'student-technique' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('student-technique')">
          <i class="fa-solid fa-medal"></i> My Syllabus Progress
        </a>
        <a href="${this.getPathForTab('student-attendance')}" class="nav-item ${this.currentTab === 'student-attendance' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('student-attendance')">
          <i class="fa-solid fa-clipboard-user"></i> Attendance History
        </a>
        <a href="${this.getPathForTab('student-fees')}" class="nav-item ${this.currentTab === 'student-fees' ? 'active' : ''}" onclick="event.preventDefault(); app.navigate('student-fees')">
          <i class="fa-solid fa-file-invoice-dollar"></i> My Invoices & Fees
        </a>
      `;
    }

    nav.innerHTML = html;
  },

  navigate(tab, updateHistory = true) {
    if (!this.isTabAllowed(tab)) {
      tab = this.getDefaultTab();
    }

    this.currentTab = tab;
    const targetPath = this.getPathForTab(tab);

    if (updateHistory) {
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ tab }, '', targetPath);
      } else {
        window.history.replaceState({ tab }, '', targetPath);
      }
    }

    this.updateDocumentTitle(tab);
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
      case 'syllabus':
        this.renderSyllabus();
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
      case 'student-technique':
        this.renderStudentTechnique();
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
              <div style="font-size: 28px; font-weight: 700; color: var(--text-heading);">${m.todayAttendance.marked}</div>
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
                <th>Active Batch</th>
                <th>Syllabus Technique</th>
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
                  <td>
                    ${s.active_batch_name ? `
                      <span class="badge badge-info" title="Enrolled: ${s.batch_enrolled_date || 'N/A'}">
                        ${s.active_batch_name}
                      </span>
                    ` : '<span style="color: var(--text-dim); font-size: 12px;">Unassigned</span>'}
                  </td>
                  <td>
                    ${s.active_technique_name ? `
                      <span class="badge badge-purple" title="Level ${s.active_technique_level} • ${s.active_technique_belt_level || 'General'}">
                        <i class="fa-solid fa-medal"></i> ${s.active_technique_name}
                      </span>
                      <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        Lvl ${s.active_technique_level} ${s.active_technique_belt_level ? '• ' + s.active_technique_belt_level : ''} • ${s.active_technique_sessions || 0} sessions
                      </div>
                    ` : '<span style="color: var(--text-dim); font-size: 12px;">No Technique</span>'}
                  </td>
                  <td><span class="badge badge-success">${s.status}</span></td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-sm" onclick="app.showStudentTechniqueModal(${s.id}, '${s.first_name} ${s.last_name}')" title="Syllabus Technique Progression">
                        <i class="fa-solid fa-graduation-cap" style="color: #a855f7;"></i> Syllabus
                      </button>
                      <button class="btn btn-primary btn-sm" onclick="app.showTransferBatchModal(${s.id}, '${s.first_name} ${s.last_name}', '${s.active_batch_name || 'None'}')" title="Transfer to New Batch">
                        <i class="fa-solid fa-right-left"></i> Transfer
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="app.showStudentBatchHistory(${s.id}, '${s.first_name} ${s.last_name}')" title="View Batch History">
                        <i class="fa-solid fa-clock-rotate-left"></i>
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

    this.currentStudentsData = students;
  },

  async showTransferBatchModal(studentId, studentName, currentBatchName) {
    const batchesData = await this.apiRequest('/api/academy/batches');
    const batches = batchesData.batches || [];
    const today = new Date().toISOString().split('T')[0];

    this.openModal(
      `Batch Transfer — ${studentName}`,
      `
        <div>
          <div style="background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.25); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 16px;">
            <p style="font-size: 13px;">Current Active Batch: <strong>${currentBatchName}</strong></p>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              Transferring will atomically close the current assignment and record a permanent audit entry.
            </p>
          </div>
          <div class="form-group">
            <label>Select Target Batch *</label>
            <select id="transfer-batch-id" class="form-select" style="width: 100%;" required>
              <option value="">-- Choose New Batch --</option>
              ${batches.map(b => `<option value="${b.id}">${b.name} (${b.sport_name} | Branch: ${b.branch_name})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Transfer Reason *</label>
            <input type="text" id="transfer-reason" class="form-input" style="width: 100%;" placeholder="e.g. Schedule clash, Level upgrade, Branch change" required>
          </div>
          <div class="form-group">
            <label>Effective Date</label>
            <input type="date" id="transfer-date" class="form-input" style="width: 100%;" value="${today}">
          </div>
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitBatchTransfer(${studentId})">
          <i class="fa-solid fa-check"></i> Confirm Transfer
        </button>
      `
    );
  },

  async submitBatchTransfer(studentId) {
    const new_batch_id = document.getElementById('transfer-batch-id').value;
    const transfer_reason = document.getElementById('transfer-reason').value.trim();
    const effective_date = document.getElementById('transfer-date').value;

    if (!new_batch_id) {
      this.showToast('Please select a target batch', 'danger');
      return;
    }
    if (!transfer_reason) {
      this.showToast('Please provide a reason for the transfer', 'danger');
      return;
    }

    const res = await this.apiRequest(`/api/academy/students/${studentId}/transfer-batch`, {
      method: 'POST',
      body: JSON.stringify({ new_batch_id, transfer_reason, effective_date }),
    });

    if (res.success) {
      this.showToast(res.message, 'success');
      this.closeModal();
      this.renderStudents();
    } else {
      this.showToast(res.error || 'Transfer failed', 'danger');
    }
  },

  async showStudentBatchHistory(studentId, studentName) {
    const res = await this.apiRequest(`/api/academy/students/${studentId}/enrollment-history`);
    if (!res.success) {
      this.showToast(res.error || 'Failed to load enrollment history', 'danger');
      return;
    }

    const history = res.history || [];

    this.openModal(
      `Batch Assignment History — ${studentName}`,
      `
        <div>
          ${history.length === 0 ? '<p style="color:var(--text-muted);">No enrollment records found.</p>' : `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${history.map((h, idx) => `
                <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; background: var(--bg-surface);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <strong style="color: var(--text-heading); font-size: 14px;">${h.batch_name}</strong>
                    <span class="badge ${h.status === 'active' ? 'badge-success' : 'badge-secondary'}">
                      ${h.status.toUpperCase()}
                    </span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted);">
                    Sport: ${h.sport_name || 'General'} | Branch: ${h.branch_name || 'Main Campus'}
                  </div>
                  <div style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">
                    Period: <strong>${h.start_date}</strong> to <strong>${h.end_date || 'Present (Active)'}</strong>
                  </div>
                  ${h.transfer_reason ? `
                    <div style="font-size: 12px; color: var(--secondary); margin-top: 6px; background: rgba(14,165,233,0.08); padding: 6px 8px; border-radius: 4px;">
                      <i class="fa-solid fa-circle-info"></i> Reason: ${h.transfer_reason}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `,
      `<button class="btn btn-secondary" onclick="app.closeModal()">Close</button>`
    );
  },

  async showAddStudentModal() {
    const [branchesData, batchesData] = await Promise.all([
      this.apiRequest('/api/academy/branches'),
      this.apiRequest('/api/academy/batches'),
    ]);

    const branches = branchesData.branches || [];
    const batches = batchesData.batches || [];
    window._cachedBatchesForStudentForm = batches;

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
          <div class="form-grid">
            <div class="form-group">
              <label>Academy Branch *</label>
              <select id="stu-branch" class="form-select" style="width: 100%;" onchange="app.onStudentBranchChange(this.value)">
                <option value="">-- Select Branch --</option>
                ${branches.map(b => `<option value="${b.id}">${b.name} (${b.city || 'Campus'})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Active Training Batch (Optional)</label>
              <select id="stu-batch" class="form-select" style="width: 100%;">
                <option value="">-- Choose Batch --</option>
                ${batches.map(b => `<option value="${b.id}" data-branch="${b.branch_id}">${b.name} (${b.sport_name})</option>`).join('')}
              </select>
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

  onStudentBranchChange(branchId) {
    const batchSelect = document.getElementById('stu-batch');
    if (!batchSelect) return;
    const allBatches = window._cachedBatchesForStudentForm || [];
    const filtered = branchId ? allBatches.filter(b => Number(b.branch_id) === Number(branchId)) : allBatches;
    batchSelect.innerHTML = `
      <option value="">-- Choose Batch --</option>
      ${filtered.map(b => `<option value="${b.id}">${b.name} (${b.sport_name})</option>`).join('')}
    `;
  },

  async submitAddStudent() {
    const first_name = document.getElementById('stu-fn').value.trim();
    const last_name = document.getElementById('stu-ln').value.trim();
    const email = document.getElementById('stu-email').value.trim();
    const phone = document.getElementById('stu-phone').value.trim();
    const guardian_name = document.getElementById('stu-guardian').value.trim();
    const date_of_birth = document.getElementById('stu-dob').value;
    const branch_id = document.getElementById('stu-branch') ? document.getElementById('stu-branch').value : null;
    const batch_id = document.getElementById('stu-batch') ? document.getElementById('stu-batch').value : null;

    if (!first_name || !last_name) {
      this.showToast('First and last name are required', 'danger');
      return;
    }

    const res = await this.apiRequest('/api/academy/students', {
      method: 'POST',
      body: JSON.stringify({
        first_name,
        last_name,
        email,
        phone,
        guardian_name,
        date_of_birth,
        branch_id: branch_id || null,
        batch_id: batch_id || null,
      }),
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
    const availableTechniques = res.availableTechniques || [];
    window._cachedAvailableTechniques = availableTechniques;

    if (!roster.length) {
      container.innerHTML = '<p style="color: var(--text-muted);">No students are currently enrolled in this batch.</p>';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <span style="font-size: 13px; font-weight: 600;">Enrolled Students (${roster.length})</span>
          <span style="font-size: 12px; color: var(--text-muted); margin-left: 8px;">
            <i class="fa-solid fa-graduation-cap" style="color: #a855f7;"></i> Syllabus Progression Active
          </span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <select id="bulk-att-tech-select" class="form-select" style="padding: 4px 8px; font-size: 12px; max-width: 200px;" onchange="app.setAllTechnique(this.value)">
            <option value="">-- Apply Technique to All --</option>
            ${availableTechniques.map(t => `<option value="${t.id}">${t.name} (Lvl ${t.level})</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="app.setAllAttendance('present')">All Present</button>
          <button class="btn btn-secondary btn-sm" onclick="app.setAllAttendance('absent')">All Absent</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th>Current Level</th>
              <th>Session Technique</th>
              <th>Technique Remark</th>
              <th>General Note</th>
            </tr>
          </thead>
          <tbody>
            ${roster.map(r => {
              const currentTechId = r.marked_technique_id || r.active_technique_id;
              return `
              <tr data-student-id="${r.student_id}">
                <td>
                  <strong>${r.first_name} ${r.last_name}</strong>
                  <div style="font-size: 11px; color: var(--text-muted);"><code>${r.student_code}</code></div>
                </td>
                <td>
                  <select class="form-select att-status-select" style="padding: 4px 8px; font-size: 12px;">
                    <option value="present" ${r.status === 'present' ? 'selected' : ''}>Present</option>
                    <option value="absent" ${r.status === 'absent' ? 'selected' : ''}>Absent</option>
                    <option value="late" ${r.status === 'late' ? 'selected' : ''}>Late</option>
                    <option value="excused" ${r.status === 'excused' ? 'selected' : ''}>Excused</option>
                  </select>
                </td>
                <td>
                  ${r.active_technique_name ? `
                    <span class="badge badge-purple" title="${r.active_category_name || ''}">
                      Lvl ${r.active_technique_level} ${r.active_technique_belt_level ? '• ' + r.active_technique_belt_level : ''}
                    </span>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                      ${r.active_sessions_attended || 0} session(s)
                    </div>
                  ` : '<span style="color: var(--text-dim); font-size: 11px;">Unassigned</span>'}
                </td>
                <td>
                  <select class="form-select att-tech-select" style="padding: 4px 8px; font-size: 12px; max-width: 190px;">
                    <option value="">-- Select Technique --</option>
                    ${availableTechniques.map(t => `
                      <option value="${t.id}" ${t.id == currentTechId ? 'selected' : ''}>
                        ${t.name} (Lvl ${t.level}${t.belt_level ? ', ' + t.belt_level : ''})
                      </option>
                    `).join('')}
                  </select>
                </td>
                <td>
                  <input type="text" class="form-input att-tech-remarks-input" style="padding: 4px 8px; font-size: 12px; width: 140px;" value="${r.marked_technique_remarks || ''}" placeholder="Technique remark">
                </td>
                <td>
                  <input type="text" class="form-input att-remark-input" style="padding: 4px 8px; font-size: 12px; width: 130px;" value="${r.remarks || ''}" placeholder="General note">
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <button class="btn btn-success" onclick="app.saveAttendance(${batchId}, '${date}')">
          <i class="fa-solid fa-floppy-disk"></i> Save Attendance & Track Technique
        </button>
      </div>
    `;
  },

  setAllAttendance(status) {
    document.querySelectorAll('.att-status-select').forEach(sel => sel.value = status);
  },

  setAllTechnique(techniqueId) {
    if (!techniqueId) return;
    document.querySelectorAll('.att-tech-select').forEach(sel => {
      sel.value = techniqueId;
    });
  },

  async saveAttendance(batchId, date) {
    const rows = document.querySelectorAll('#attendance-roster-container tbody tr');
    const entries = [];

    rows.forEach(row => {
      const student_id = row.getAttribute('data-student-id');
      const status = row.querySelector('.att-status-select').value;
      const remarks = row.querySelector('.att-remark-input').value.trim();
      const techSelect = row.querySelector('.att-tech-select');
      const techRemarkInput = row.querySelector('.att-tech-remarks-input');

      entries.push({
        student_id,
        status,
        remarks,
        technique_id: techSelect && techSelect.value ? Number(techSelect.value) : null,
        technique_status: 'keep',
        technique_remarks: techRemarkInput ? techRemarkInput.value.trim() : null,
      });
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
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="card-title"><i class="fa-solid fa-calendar-days"></i> Training Batches & Schedules (${batches.length})</h2>
          <button class="btn btn-primary btn-sm" onclick="app.showAddBatchModal()">
            <i class="fa-solid fa-plus"></i> New Training Batch
          </button>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Batch Name</th>
                <th>Sport</th>
                <th>Branch</th>
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
                  <td>${b.branch_name || 'Main Campus'}</td>
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

  async showAddBatchModal() {
    const [branchesData, sportsData, coachesData] = await Promise.all([
      this.apiRequest('/api/academy/branches'),
      this.apiRequest('/api/academy/sports'),
      this.apiRequest('/api/academy/coaches'),
    ]);

    const branches = branchesData.branches || [];
    const sports = sportsData.sports || [];
    const coaches = coachesData.coaches || [];

    this.openModal(
      'Create New Training Batch',
      `
        <form id="add-batch-form">
          <div class="form-group">
            <label>Batch Name *</label>
            <input type="text" id="batch-name" class="form-input" style="width: 100%;" placeholder="e.g. Under-17 Elite Champions" required>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Branch * (Rule C: 1 Batch belongs to 1 Branch)</label>
              <select id="batch-branch" class="form-select" style="width: 100%;" required>
                <option value="">-- Select Branch --</option>
                ${branches.map(b => `<option value="${b.id}">${b.name} (${b.city || 'Campus'})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Sport *</label>
              <select id="batch-sport" class="form-select" style="width: 100%;" required>
                <option value="">-- Select Sport --</option>
                ${sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Coach</label>
              <select id="batch-coach" class="form-select" style="width: 100%;">
                <option value="">-- Select Coach (Optional) --</option>
                ${coaches.map(c => `<option value="${c.id}">${c.name} (${c.sport_name || 'Coach'})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Monthly Fee (₹)</label>
              <input type="number" id="batch-fee" class="form-input" style="width: 100%;" value="2500" min="0">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Start Time * (HH:MM)</label>
              <input type="time" id="batch-start-time" class="form-input" style="width: 100%;" value="06:30" required>
            </div>
            <div class="form-group">
              <label>End Time * (HH:MM)</label>
              <input type="time" id="batch-end-time" class="form-input" style="width: 100%;" value="08:00" required>
            </div>
          </div>
          <div class="form-group">
            <label>Max Student Capacity</label>
            <input type="number" id="batch-capacity" class="form-input" style="width: 100%;" value="25" min="1">
          </div>
        </form>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitAddBatch()"><i class="fa-solid fa-check"></i> Create Batch</button>
      `
    );
  },

  async submitAddBatch() {
    const name = document.getElementById('batch-name').value.trim();
    const branch_id = document.getElementById('batch-branch').value;
    const sport_id = document.getElementById('batch-sport').value;
    const coach_id = document.getElementById('batch-coach').value;
    const start_time = document.getElementById('batch-start-time').value;
    const end_time = document.getElementById('batch-end-time').value;
    const monthly_fee = document.getElementById('batch-fee').value;
    const max_capacity = document.getElementById('batch-capacity').value;

    if (!name || !start_time || !end_time) {
      this.showToast('Batch name and start/end times are required', 'danger');
      return;
    }
    if (!branch_id) {
      this.showToast('Every batch must belong to a branch (Rule C)', 'danger');
      return;
    }

    const res = await this.apiRequest('/api/academy/batches', {
      method: 'POST',
      body: JSON.stringify({
        name,
        branch_id: Number(branch_id),
        sport_id: sport_id ? Number(sport_id) : null,
        coach_id: coach_id ? Number(coach_id) : null,
        start_time,
        end_time,
        monthly_fee: Number(monthly_fee) || 0,
        max_capacity: Number(max_capacity) || 30,
      }),
    });

    if (res.success) {
      this.showToast(res.message, 'success');
      this.closeModal();
      this.renderBatches();
    } else {
      this.showToast(res.error || 'Failed to create batch', 'danger');
    }
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
            <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px;">
              <span class="badge badge-info">${b.sport_name}</span>
              <h3 style="font-size: 16px; font-weight: 600; color: var(--text-heading); margin: 8px 0;">${b.name}</h3>
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
  // SYLLABUS & TECHNIQUE PROGRESSION UI
  // ==========================================

  currentSyllabusTab: 'techniques',

  async renderSyllabus(tab = this.currentSyllabusTab || 'techniques') {
    this.currentSyllabusTab = tab;
    const content = document.getElementById('page-content');

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <div>
            <h2 class="card-title"><i class="fa-solid fa-graduation-cap" style="color: #a855f7;"></i> Sports Syllabus & Learning Progression</h2>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Manage sports techniques, curriculum difficulty levels, student progression, and session tracking
            </p>
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="app.exportSyllabusExcel()">
              <i class="fa-solid fa-file-excel" style="color: #10b981;"></i> Export Excel
            </button>
            <button class="btn btn-secondary btn-sm" onclick="app.showAddCategoryModal()">
              <i class="fa-solid fa-folder-plus"></i> New Category
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.showAddTechniqueModal()">
              <i class="fa-solid fa-plus"></i> New Technique
            </button>
          </div>
        </div>

        <div class="syllabus-tabs">
          <button class="syllabus-tab-btn ${tab === 'techniques' ? 'active' : ''}" onclick="app.renderSyllabus('techniques')">
            <i class="fa-solid fa-dumbbell"></i> Techniques Curriculum
          </button>
          <button class="syllabus-tab-btn ${tab === 'categories' ? 'active' : ''}" onclick="app.renderSyllabus('categories')">
            <i class="fa-solid fa-folder-tree"></i> Syllabus Categories
          </button>
          <button class="syllabus-tab-btn ${tab === 'reports' ? 'active' : ''}" onclick="app.renderSyllabus('reports')">
            <i class="fa-solid fa-chart-line"></i> Learning & Progression Reports
          </button>
        </div>

        <div id="syllabus-tab-content" style="padding: 20px;">
          <div style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
        </div>
      </div>
    `;

    if (tab === 'techniques') {
      await this.loadSyllabusTechniquesTab();
    } else if (tab === 'categories') {
      await this.loadSyllabusCategoriesTab();
    } else if (tab === 'reports') {
      await this.loadSyllabusReportsTab();
    }
  },

  async loadSyllabusTechniquesTab() {
    const container = document.getElementById('syllabus-tab-content');
    const [techRes, catRes] = await Promise.all([
      this.apiRequest('/api/academy/syllabus-techniques?include_inactive=true'),
      this.apiRequest('/api/academy/syllabus-categories?include_inactive=true'),
    ]);

    const techniques = techRes.techniques || [];
    const categories = catRes.categories || [];
    window._cachedSyllabusCategories = categories;
    window._cachedSyllabusTechniques = techniques;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <input type="text" id="tech-search-input" class="form-input" placeholder="Search name, code, belt..." oninput="app.filterTechniquesTable()" style="font-size: 12px; width: 190px;">
          <select id="tech-filter-category" class="form-select" onchange="app.filterTechniquesTable()" style="font-size: 12px;">
            <option value="">All Categories</option>
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <select id="tech-filter-level" class="form-select" onchange="app.filterTechniquesTable()" style="font-size: 12px;">
            <option value="">All Difficulty Levels</option>
            <option value="1">Level 1 (Beginner)</option>
            <option value="2">Level 2 (Novice)</option>
            <option value="3">Level 3 (Intermediate)</option>
            <option value="4">Level 4 (Advanced)</option>
            <option value="5">Level 5 (Mastery)</option>
          </select>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="app.showReorderTechniquesModal()">
            <i class="fa-solid fa-arrows-up-down"></i> Reorder
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table" id="techniques-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Technique Name & Code</th>
              <th>Category</th>
              <th>Difficulty Level</th>
              <th>Belt / Rank</th>
              <th>Active Students</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${techniques.length === 0 ? `
              <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No techniques created yet. Click "New Technique" to build your syllabus curriculum.</td></tr>
            ` : techniques.map(t => `
              <tr data-cat-id="${t.category_id}" data-level="${t.level}">
                <td><code>#${t.display_order}</code></td>
                <td>
                  <strong>${t.name}</strong>
                  ${t.code ? `<span style="font-size: 11px; color: var(--text-dim); margin-left: 6px;">[${t.code}]</span>` : ''}
                  ${t.description ? `<div style="font-size: 11px; color: var(--text-muted);">${t.description}</div>` : ''}
                  ${t.media_url ? `<div style="margin-top: 2px;"><a href="${t.media_url}" target="_blank" style="font-size: 11px; color: var(--secondary);"><i class="fa-solid fa-link"></i> Media Reference</a></div>` : ''}
                </td>
                <td><span class="badge badge-info">${t.category_name}</span></td>
                <td><span class="badge badge-purple">Level ${t.level}</span></td>
                <td>
                  ${t.belt_level ? `<span class="badge badge-warning">${t.belt_level}</span>` : '<span style="color: var(--text-dim); font-size: 12px;">-</span>'}
                </td>
                <td>
                  <strong>${t.active_students_count || 0}</strong> students
                </td>
                <td>
                  <span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-secondary'}">${t.status}</span>
                </td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" onclick="app.showEditTechniqueModal(${t.id})">
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteTechnique(${t.id}, '${t.name.replace(/'/g, "\\'")}')">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  filterTechniquesTable() {
    const catId = document.getElementById('tech-filter-category').value;
    const level = document.getElementById('tech-filter-level').value;
    const search = (document.getElementById('tech-search-input')?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#techniques-table tbody tr');

    rows.forEach(r => {
      const matchCat = !catId || r.getAttribute('data-cat-id') === catId;
      const matchLvl = !level || r.getAttribute('data-level') === level;
      const text = r.innerText.toLowerCase();
      const matchSearch = !search || text.includes(search);
      r.style.display = (matchCat && matchLvl && matchSearch) ? '' : 'none';
    });
  },

  async loadSyllabusCategoriesTab() {
    const container = document.getElementById('syllabus-tab-content');
    const res = await this.apiRequest('/api/academy/syllabus-categories?include_inactive=true');
    const categories = res.categories || [];
    window._cachedSyllabusCategories = categories;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <span style="font-size: 13px; font-weight: 600;">Syllabus Categories (${categories.length})</span>
        <button class="btn btn-secondary btn-sm" onclick="app.showReorderCategoriesModal()">
          <i class="fa-solid fa-arrows-up-down"></i> Reorder Categories
        </button>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Category Name</th>
              <th>Description</th>
              <th>Techniques Count</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${categories.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No categories created yet. Click "New Category" to get started.</td></tr>
            ` : categories.map(c => `
              <tr>
                <td><code>#${c.display_order}</code></td>
                <td><strong>${c.name}</strong></td>
                <td><span style="color: var(--text-muted); font-size: 12px;">${c.description || '-'}</span></td>
                <td>
                  <span class="badge badge-info">${c.technique_count || 0} techniques</span>
                </td>
                <td>
                  <span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-secondary'}">${c.status}</span>
                </td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" onclick="app.showEditCategoryModal(${c.id})">
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteCategory(${c.id}, '${c.name.replace(/'/g, "\\'")}')">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async loadSyllabusReportsTab() {
    const container = document.getElementById('syllabus-tab-content');
    const res = await this.apiRequest('/api/academy/syllabus-reports');

    if (!res.success) {
      container.innerHTML = `<div class="toast danger">${res.error}</div>`;
      return;
    }

    const { byTechnique = [], extendedDurationStudents = [], monthlyTechniqueAttendance = [] } = res;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
        <!-- Card 1: Students Grouped by Technique -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px;">
          <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
            <i class="fa-solid fa-users" style="color: #3b82f6;"></i> Students by Active Technique
          </h3>
          <div class="table-responsive" style="max-height: 350px;">
            <table class="custom-table" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>Technique</th>
                  <th>Level</th>
                  <th>Active</th>
                  <th>Avg Sessions</th>
                </tr>
              </thead>
              <tbody>
                ${byTechnique.length === 0 ? '<tr><td colspan="4" style="color: var(--text-muted);">No data</td></tr>' : byTechnique.map(t => `
                  <tr>
                    <td><strong>${t.technique_name}</strong></td>
                    <td><span class="badge badge-purple">Lvl ${t.level}</span></td>
                    <td><strong>${t.student_count}</strong></td>
                    <td>${Math.round(t.avg_sessions_attended)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Card 2: Extended Duration Alerts -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px;">
          <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> Extended Duration Students (>25 sessions / 60+ days)
          </h3>
          <div class="table-responsive" style="max-height: 350px;">
            <table class="custom-table" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Technique</th>
                  <th>Sessions</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${extendedDurationStudents.length === 0 ? '<tr><td colspan="4" style="color: var(--text-muted);">No students stuck on extended duration. Great progress!</td></tr>' : extendedDurationStudents.map(s => `
                  <tr>
                    <td>
                      <strong>${s.first_name} ${s.last_name}</strong>
                      <div style="font-size: 10px; color: var(--text-dim);">${s.student_code}</div>
                    </td>
                    <td><span class="badge badge-purple">${s.technique_name}</span></td>
                    <td><span class="badge badge-warning">${s.sessions_attended} sessions</span></td>
                    <td>
                      <button class="btn btn-primary btn-sm" onclick="app.showStudentTechniqueModal(${s.student_id}, '${s.first_name} ${s.last_name}')">
                        Review / Upgrade
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Card 3: Monthly Technique Training Volume -->
        <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px;">
          <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
            <i class="fa-solid fa-calendar-days" style="color: #10b981;"></i> Monthly Technique Training Volume (Attended Sessions Across Months)
          </h3>
          <div class="table-responsive" style="max-height: 250px;">
            <table class="custom-table" style="font-size: 12px;">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Technique</th>
                  <th>Sessions Marked Present</th>
                </tr>
              </thead>
              <tbody>
                ${monthlyTechniqueAttendance.length === 0 ? '<tr><td colspan="3" style="color: var(--text-muted);">No monthly attendance records yet.</td></tr>' : monthlyTechniqueAttendance.map(m => `
                  <tr>
                    <td><code>${m.month}</code></td>
                    <td><strong>${m.technique_name}</strong></td>
                    <td><span class="badge badge-success">${m.sessions_marked_present} sessions</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // CATEGORY MODALS & ACTIONS
  showAddCategoryModal() {
    this.openModal(
      'New Syllabus Category',
      `
        <form id="add-cat-form">
          <div class="form-group">
            <label>Category Name *</label>
            <input type="text" id="cat-name" class="form-input" style="width: 100%;" placeholder="e.g. Punching Techniques, Kata, Kumite" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="cat-desc" class="form-textarea" style="width: 100%; height: 80px;" placeholder="Curriculum notes and objectives..."></textarea>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Display Order</label>
              <input type="number" id="cat-order" class="form-input" style="width: 100%;" value="0">
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="cat-status" class="form-select" style="width: 100%;">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitAddCategory()"><i class="fa-solid fa-plus"></i> Create Category</button>
      `
    );
  },

  async submitAddCategory() {
    const name = document.getElementById('cat-name').value.trim();
    const description = document.getElementById('cat-desc').value.trim();
    const display_order = Number(document.getElementById('cat-order').value) || 0;
    const status = document.getElementById('cat-status').value;

    if (!name) {
      this.showToast('Category name is required', 'danger');
      return;
    }

    const res = await this.apiRequest('/api/academy/syllabus-categories', {
      method: 'POST',
      body: JSON.stringify({ name, description, display_order, status }),
    });

    if (res.success) {
      this.showToast('Category created successfully', 'success');
      this.closeModal();
      this.renderSyllabus('categories');
    } else {
      this.showToast(res.error || 'Failed to create category', 'danger');
    }
  },

  showEditCategoryModal(categoryId) {
    const cat = (window._cachedSyllabusCategories || []).find(c => c.id === categoryId);
    if (!cat) return;

    this.openModal(
      `Edit Category — ${cat.name}`,
      `
        <form id="edit-cat-form">
          <div class="form-group">
            <label>Category Name *</label>
            <input type="text" id="edit-cat-name" class="form-input" style="width: 100%;" value="${cat.name}" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="edit-cat-desc" class="form-textarea" style="width: 100%; height: 80px;">${cat.description || ''}</textarea>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Display Order</label>
              <input type="number" id="edit-cat-order" class="form-input" style="width: 100%;" value="${cat.display_order}">
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="edit-cat-status" class="form-select" style="width: 100%;">
                <option value="active" ${cat.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="inactive" ${cat.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>
        </form>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitEditCategory(${categoryId})"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
      `
    );
  },

  async submitEditCategory(categoryId) {
    const name = document.getElementById('edit-cat-name').value.trim();
    const description = document.getElementById('edit-cat-desc').value.trim();
    const display_order = Number(document.getElementById('edit-cat-order').value) || 0;
    const status = document.getElementById('edit-cat-status').value;

    const res = await this.apiRequest(`/api/academy/syllabus-categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, display_order, status }),
    });

    if (res.success) {
      this.showToast('Category updated successfully', 'success');
      this.closeModal();
      this.renderSyllabus('categories');
    } else {
      this.showToast(res.error || 'Failed to update category', 'danger');
    }
  },

  async deleteCategory(categoryId, categoryName) {
    if (!confirm(`Are you sure you want to delete category "${categoryName}"? Deletion is protected if techniques exist.`)) {
      return;
    }

    const res = await this.apiRequest(`/api/academy/syllabus-categories/${categoryId}`, {
      method: 'DELETE',
    });

    if (res.success) {
      this.showToast(res.message, 'success');
      this.renderSyllabus('categories');
    } else {
      this.showToast(res.error || 'Failed to delete category', 'danger');
    }
  },

  showReorderCategoriesModal() {
    const categories = window._cachedSyllabusCategories || [];
    this.openModal(
      'Reorder Categories',
      `
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          <i class="fa-solid fa-hand-pointer" style="color: #38bdf8;"></i> Drag and drop rows to reorder, or use the up/down arrow buttons:
        </p>
        <div class="reorder-list" id="reorder-cats-list">
          ${categories.map((c, idx) => `
            <div class="reorder-item" draggable="true" data-id="${c.id}">
              <div class="reorder-item-left">
                <i class="fa-solid fa-grip-vertical reorder-handle"></i>
                <span class="reorder-rank">${idx + 1}</span>
                <div>
                  <strong>${c.name}</strong>
                  ${c.description ? `<div style="font-size: 11px; color: var(--text-muted);">${c.description}</div>` : ''}
                </div>
              </div>
              <div class="reorder-controls">
                <button type="button" class="reorder-btn" onclick="app.moveReorderItem(this, -1)" title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="reorder-btn" onclick="app.moveReorderItem(this, 1)" title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitReorderCategories()"><i class="fa-solid fa-check"></i> Apply Order</button>
      `
    );
    this.initDragAndDrop('reorder-cats-list');
  },

  async submitReorderCategories() {
    const container = document.getElementById('reorder-cats-list');
    if (!container) return;
    const items = container.querySelectorAll('.reorder-item');
    const orderIds = Array.from(items).map(item => Number(item.getAttribute('data-id')));

    const res = await this.apiRequest('/api/academy/syllabus-categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderIds }),
    });

    if (res.success) {
      this.showToast('Categories reordered successfully', 'success');
      this.closeModal();
      this.renderSyllabus('categories');
    } else {
      this.showToast(res.error || 'Failed to reorder categories', 'danger');
    }
  },

  // TECHNIQUE MODALS & ACTIONS
  showAddTechniqueModal() {
    const categories = window._cachedSyllabusCategories || [];
    this.openModal(
      'New Syllabus Technique',
      `
        <form id="add-tech-form">
          <div class="form-grid">
            <div class="form-group">
              <label>Syllabus Category *</label>
              <select id="tech-cat" class="form-select" style="width: 100%;" required>
                <option value="">-- Select Category --</option>
                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Technique Code (Optional)</label>
              <input type="text" id="tech-code" class="form-input" style="width: 100%;" placeholder="e.g. KICK-01, KATA-H1">
            </div>
          </div>
          <div class="form-group">
            <label>Technique Name *</label>
            <input type="text" id="tech-name" class="form-input" style="width: 100%;" placeholder="e.g. Mae-Geri (Front Kick), Heian Shodan" required>
          </div>
          <div class="form-group">
            <label>Description & Learning Criteria</label>
            <textarea id="tech-desc" class="form-textarea" style="width: 100%; height: 70px;" placeholder="Execution details, stance criteria, key points..."></textarea>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Difficulty Level *</label>
              <select id="tech-level" class="form-select" style="width: 100%;">
                <option value="1">Level 1 — Beginner</option>
                <option value="2">Level 2 — Novice</option>
                <option value="3">Level 3 — Intermediate</option>
                <option value="4">Level 4 — Advanced</option>
                <option value="5">Level 5 — Mastery</option>
              </select>
            </div>
            <div class="form-group">
              <label>Belt / Rank Association</label>
              <input type="text" id="tech-belt" class="form-input" style="width: 100%;" placeholder="e.g. White Belt, Yellow Belt, Brown Belt">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Media / Video Link</label>
              <input type="url" id="tech-media" class="form-input" style="width: 100%;" placeholder="https://youtube.com/...">
            </div>
            <div class="form-group">
              <label>Display Order</label>
              <input type="number" id="tech-order" class="form-input" style="width: 100%;" value="0">
            </div>
          </div>
        </form>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitAddTechnique()"><i class="fa-solid fa-plus"></i> Create Technique</button>
      `
    );
  },

  async submitAddTechnique() {
    const category_id = document.getElementById('tech-cat').value;
    const name = document.getElementById('tech-name').value.trim();
    const code = document.getElementById('tech-code').value.trim();
    const description = document.getElementById('tech-desc').value.trim();
    const level = Number(document.getElementById('tech-level').value) || 1;
    const belt_level = document.getElementById('tech-belt').value.trim();
    const media_url = document.getElementById('tech-media').value.trim();
    const display_order = Number(document.getElementById('tech-order').value) || 0;

    if (!category_id || !name) {
      this.showToast('Category and technique name are required', 'danger');
      return;
    }

    const res = await this.apiRequest('/api/academy/syllabus-techniques', {
      method: 'POST',
      body: JSON.stringify({ category_id, name, code, description, level, belt_level, media_url, display_order }),
    });

    if (res.success) {
      this.showToast('Technique created successfully', 'success');
      this.closeModal();
      this.renderSyllabus('techniques');
    } else {
      this.showToast(res.error || 'Failed to create technique', 'danger');
    }
  },

  showEditTechniqueModal(techniqueId) {
    const tech = (window._cachedSyllabusTechniques || []).find(t => t.id === techniqueId);
    const categories = window._cachedSyllabusCategories || [];
    if (!tech) return;

    this.openModal(
      `Edit Technique — ${tech.name}`,
      `
        <form id="edit-tech-form">
          <div class="form-grid">
            <div class="form-group">
              <label>Syllabus Category *</label>
              <select id="edit-tech-cat" class="form-select" style="width: 100%;">
                ${categories.map(c => `<option value="${c.id}" ${c.id === tech.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Technique Code</label>
              <input type="text" id="edit-tech-code" class="form-input" style="width: 100%;" value="${tech.code || ''}">
            </div>
          </div>
          <div class="form-group">
            <label>Technique Name *</label>
            <input type="text" id="edit-tech-name" class="form-input" style="width: 100%;" value="${tech.name}" required>
          </div>
          <div class="form-group">
            <label>Description & Notes</label>
            <textarea id="edit-tech-desc" class="form-textarea" style="width: 100%; height: 70px;">${tech.description || ''}</textarea>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Difficulty Level</label>
              <select id="edit-tech-level" class="form-select" style="width: 100%;">
                <option value="1" ${tech.level === 1 ? 'selected' : ''}>Level 1 — Beginner</option>
                <option value="2" ${tech.level === 2 ? 'selected' : ''}>Level 2 — Novice</option>
                <option value="3" ${tech.level === 3 ? 'selected' : ''}>Level 3 — Intermediate</option>
                <option value="4" ${tech.level === 4 ? 'selected' : ''}>Level 4 — Advanced</option>
                <option value="5" ${tech.level === 5 ? 'selected' : ''}>Level 5 — Mastery</option>
              </select>
            </div>
            <div class="form-group">
              <label>Belt / Rank Association</label>
              <input type="text" id="edit-tech-belt" class="form-input" style="width: 100%;" value="${tech.belt_level || ''}">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Media / Video Link</label>
              <input type="url" id="edit-tech-media" class="form-input" style="width: 100%;" value="${tech.media_url || ''}">
            </div>
            <div class="form-group">
              <label>Display Order</label>
              <input type="number" id="edit-tech-order" class="form-input" style="width: 100%;" value="${tech.display_order}">
            </div>
          </div>
        </form>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitEditTechnique(${techniqueId})"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
      `
    );
  },

  async submitEditTechnique(techniqueId) {
    const category_id = document.getElementById('edit-tech-cat').value;
    const name = document.getElementById('edit-tech-name').value.trim();
    const code = document.getElementById('edit-tech-code').value.trim();
    const description = document.getElementById('edit-tech-desc').value.trim();
    const level = Number(document.getElementById('edit-tech-level').value) || 1;
    const belt_level = document.getElementById('edit-tech-belt').value.trim();
    const media_url = document.getElementById('edit-tech-media').value.trim();
    const display_order = Number(document.getElementById('edit-tech-order').value) || 0;

    const res = await this.apiRequest(`/api/academy/syllabus-techniques/${techniqueId}`, {
      method: 'PUT',
      body: JSON.stringify({ category_id, name, code, description, level, belt_level, media_url, display_order }),
    });

    if (res.success) {
      this.showToast('Technique updated successfully', 'success');
      this.closeModal();
      this.renderSyllabus('techniques');
    } else {
      this.showToast(res.error || 'Failed to update technique', 'danger');
    }
  },

  async deleteTechnique(techniqueId, techniqueName) {
    if (!confirm(`Are you sure you want to delete technique "${techniqueName}"? If students have history, it will be safely archived.`)) {
      return;
    }

    const res = await this.apiRequest(`/api/academy/syllabus-techniques/${techniqueId}`, {
      method: 'DELETE',
    });

    if (res.success) {
      this.showToast(res.message, 'success');
      this.renderSyllabus('techniques');
    } else {
      this.showToast(res.error || 'Failed to delete technique', 'danger');
    }
  },

  showReorderTechniquesModal() {
    const techniques = window._cachedSyllabusTechniques || [];
    this.openModal(
      'Reorder Techniques',
      `
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          <i class="fa-solid fa-hand-pointer" style="color: #38bdf8;"></i> Drag and drop rows to reorder, or use the up/down arrow buttons:
        </p>
        <div class="reorder-list" id="reorder-tech-list">
          ${techniques.map((t, idx) => `
            <div class="reorder-item" draggable="true" data-id="${t.id}">
              <div class="reorder-item-left">
                <i class="fa-solid fa-grip-vertical reorder-handle"></i>
                <span class="reorder-rank">${idx + 1}</span>
                <div>
                  <strong>${t.name}</strong>
                  ${t.code ? `<span style="font-size: 11px; color: var(--text-dim); margin-left: 6px;">[${t.code}]</span>` : ''}
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                    <span class="badge badge-purple" style="font-size: 10px; padding: 2px 6px;">Lvl ${t.level}</span>
                    ${t.belt_level ? `<span class="badge badge-warning" style="font-size: 10px; padding: 2px 6px; margin-left: 4px;">${t.belt_level}</span>` : ''}
                    <span style="margin-left: 6px;">${t.category_name || ''}</span>
                  </div>
                </div>
              </div>
              <div class="reorder-controls">
                <button type="button" class="reorder-btn" onclick="app.moveReorderItem(this, -1)" title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="reorder-btn" onclick="app.moveReorderItem(this, 1)" title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitReorderTechniques()"><i class="fa-solid fa-check"></i> Apply Order</button>
      `
    );
    this.initDragAndDrop('reorder-tech-list');
  },

  async submitReorderTechniques() {
    const container = document.getElementById('reorder-tech-list');
    if (!container) return;
    const items = container.querySelectorAll('.reorder-item');
    const orderIds = Array.from(items).map(item => Number(item.getAttribute('data-id')));

    const res = await this.apiRequest('/api/academy/syllabus-techniques/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderIds }),
    });

    if (res.success) {
      this.showToast('Techniques reordered successfully', 'success');
      this.closeModal();
      this.renderSyllabus('techniques');
    } else {
      this.showToast(res.error || 'Failed to reorder techniques', 'danger');
    }
  },

  initDragAndDrop(containerId) {
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (!container) return;

      let draggedItem = null;

      const items = container.querySelectorAll('.reorder-item');
      items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
          draggedItem = item;
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', item.getAttribute('data-id'));
        });

        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          container.querySelectorAll('.reorder-item').forEach(el => el.classList.remove('drag-over'));
          draggedItem = null;
          app.updateReorderRanks(containerId);
        });

        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!draggedItem || item === draggedItem) return;

          const bounding = item.getBoundingClientRect();
          const offset = bounding.y + (bounding.height / 2);
          if (e.clientY > offset) {
            item.after(draggedItem);
          } else {
            item.before(draggedItem);
          }
          app.updateReorderRanks(containerId);
        });

        item.addEventListener('dragenter', (e) => {
          e.preventDefault();
          if (draggedItem && item !== draggedItem) {
            item.classList.add('drag-over');
          }
        });

        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over');
        });
      });
    }, 50);
  },

  updateReorderRanks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const items = container.querySelectorAll('.reorder-item');
    items.forEach((item, index) => {
      const rank = item.querySelector('.reorder-rank');
      if (rank) rank.innerText = index + 1;
    });
  },

  moveReorderItem(btn, direction) {
    const item = btn.closest('.reorder-item');
    const container = item.parentElement;
    if (direction === -1 && item.previousElementSibling) {
      item.previousElementSibling.before(item);
    } else if (direction === 1 && item.nextElementSibling) {
      item.nextElementSibling.after(item);
    }
    this.updateReorderRanks(container.id);
  },

  // ==========================================
  // SYLLABUS EXCEL EXPORT (SheetJS)
  // ==========================================
  async exportSyllabusExcel() {
    try {
      this.showToast('Preparing Syllabus Excel export...', 'info');
      const [techRes, catRes] = await Promise.all([
        this.apiRequest('/api/academy/syllabus-techniques?include_inactive=true'),
        this.apiRequest('/api/academy/syllabus-categories?include_inactive=true'),
      ]);

      const techniques = techRes.techniques || [];
      const categories = catRes.categories || [];

      if (!window.XLSX) {
        this.showToast('Excel library (SheetJS) is unavailable', 'danger');
        return;
      }

      const techData = techniques.map((t, idx) => ({
        'Order': t.display_order ?? (idx + 1),
        'Technique Name': t.name,
        'Code': t.code || '-',
        'Category': t.category_name,
        'Difficulty Level': `Level ${t.level}`,
        'Belt / Rank': t.belt_level || '-',
        'Active Students': t.active_students_count || 0,
        'Status': t.status,
        'Description': t.description || '-',
        'Media Reference': t.media_url || '-'
      }));

      const catData = categories.map((c, idx) => ({
        'Order': c.display_order ?? (idx + 1),
        'Category Name': c.name,
        'Description': c.description || '-',
        'Total Techniques': c.technique_count || 0,
        'Status': c.status
      }));

      const wb = window.XLSX.utils.book_new();
      const wsTechniques = window.XLSX.utils.json_to_sheet(techData);
      const wsCategories = window.XLSX.utils.json_to_sheet(catData);

      window.XLSX.utils.book_append_sheet(wb, wsTechniques, 'Syllabus Techniques');
      window.XLSX.utils.book_append_sheet(wb, wsCategories, 'Categories');

      const fileName = `sports_syllabus_curriculum_${new Date().toISOString().split('T')[0]}.xlsx`;
      window.XLSX.writeFile(wb, fileName);
      this.showToast('Curriculum Excel downloaded successfully!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      this.showToast('Failed to export syllabus: ' + err.message, 'danger');
    }
  },

  // ==========================================
  // STUDENT BELT / PROGRESSION CERTIFICATE (jsPDF)
  // ==========================================
  async downloadStudentCertificate(studentId, studentName) {
    try {
      this.showToast('Generating official Belt & Progression Certificate...', 'info');
      let histData;
      if (studentId) {
        histData = await this.apiRequest(`/api/academy/students/${studentId}/technique-history`);
      } else {
        histData = await this.apiRequest('/api/student/technique-history');
        studentName = this.currentUser ? `${this.currentUser.first_name || ''} ${this.currentUser.last_name || ''}`.trim() || 'Martial Arts Student' : 'Martial Arts Student';
      }

      if (!histData || !histData.success) {
        this.showToast('Could not load student progress details for certificate', 'danger');
        return;
      }

      const { currentTechnique, totalAttendedAcrossTechniques = 0 } = histData;
      const techniqueName = currentTechnique ? currentTechnique.technique_name : 'Sports Syllabus Curriculum';
      const beltLevel = (currentTechnique && currentTechnique.technique_belt_level) ? currentTechnique.technique_belt_level : 'Graded Rank';
      const difficultyLvl = currentTechnique ? `Level ${currentTechnique.technique_level}` : 'Foundation Level';
      const sessions = currentTechnique ? currentTechnique.sessions_attended : totalAttendedAcrossTechniques;

      if (!window.jspdf || !window.jspdf.jsPDF) {
        this.showToast('PDF generator library is unavailable', 'danger');
        return;
      }

      const { jsPDF } = window.jspdf;
      // Landscape A4: 297mm x 210mm
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Outer & Inner Borders
      doc.setDrawColor(37, 99, 235); // #2563eb
      doc.setLineWidth(3);
      doc.rect(8, 8, 281, 194);

      doc.setDrawColor(217, 119, 6); // amber/gold border
      doc.setLineWidth(1);
      doc.rect(12, 12, 273, 186);

      // Academy Header
      const academyName = (this.currentAcademy && this.currentAcademy.name) ? this.currentAcademy.name.toUpperCase() : 'INTERNATIONAL SPORTS ACADEMY';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text(academyName, 148.5, 30, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('OFFICIAL MARTIAL ARTS & SPORTS EXCELLENCE ACCREDITATION', 148.5, 37, { align: 'center' });

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(168, 85, 247); // purple
      doc.text('CERTIFICATE OF PROGRESSION', 148.5, 54, { align: 'center' });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(13);
      doc.setTextColor(71, 85, 105);
      doc.text('This is proudly presented to', 148.5, 68, { align: 'center' });

      // Student Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(15, 23, 42);
      doc.text(studentName.toUpperCase(), 148.5, 83, { align: 'center' });

      // Underline under student name
      doc.setDrawColor(168, 85, 247);
      doc.setLineWidth(0.8);
      doc.line(80, 87, 217, 87);

      // Progression Body Text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.setTextColor(51, 65, 85);
      doc.text('in recognition of exemplary technical competence, discipline, and milestone advancement in:', 148.5, 98, { align: 'center' });

      // Technique & Belt details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19);
      doc.setTextColor(37, 99, 235);
      doc.text(`${techniqueName} — ${beltLevel} (${difficultyLvl})`, 148.5, 112, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text(`Successfully completed ${sessions} dedicated training sessions under certified instruction.`, 148.5, 122, { align: 'center' });

      // Certificate Details Box
      const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(`Certificate Ref: ISS-${studentId || 'STU'}-${Date.now().toString().slice(-6)}   |   Issued: ${todayStr}`, 148.5, 142, { align: 'center' });

      // Signature Lines
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.5);
      doc.line(45, 172, 105, 172);
      doc.line(192, 172, 252, 172);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Head Sensei / Chief Coach', 75, 178, { align: 'center' });
      doc.text('Academy Director', 222, 178, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text('Authorized Instructor Signature', 75, 183, { align: 'center' });
      doc.text('Official Seal & Verification', 222, 183, { align: 'center' });

      const safeName = studentName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      doc.save(`certificate_${safeName}_${beltLevel.toLowerCase().replace(/\s+/g, '_')}.pdf`);
      this.showToast('Progression Certificate downloaded successfully!', 'success');
    } catch (err) {
      console.error('Certificate generation error:', err);
      this.showToast('Failed to generate certificate: ' + err.message, 'danger');
    }
  },

  // ==========================================
  // STUDENT TECHNIQUE PROGRESSION MODAL
  // ==========================================

  async showStudentTechniqueModal(studentId, studentName) {
    this.openModal(
      `Syllabus Progression — ${studentName}`,
      `<div style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>`
    );

    const res = await this.apiRequest(`/api/academy/students/${studentId}/technique-history`);
    if (!res.success) {
      this.openModal(`Error`, `<div class="toast danger">${res.error}</div>`);
      return;
    }

    const { currentTechnique, history = [], totalAttendedAcrossTechniques = 0, snapshots = [] } = res;

    this.openModal(
      `Syllabus Progression — ${studentName}`,
      `
        <div>
          <!-- Current Active Technique Card -->
          <div style="background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(37,99,235,0.1)); border: 1px solid rgba(168,85,247,0.3); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
              <div>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Current Active Technique</span>
                <h3 style="font-size: 18px; font-weight: 700; color: var(--text-heading); margin-top: 4px;">
                  ${currentTechnique ? currentTechnique.technique_name : 'No Active Technique Assigned'}
                </h3>
                <div style="margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                  ${currentTechnique ? `
                    <span class="badge badge-purple">Level ${currentTechnique.technique_level}</span>
                    ${currentTechnique.technique_belt_level ? `<span class="badge badge-warning">${currentTechnique.technique_belt_level}</span>` : ''}
                    <span class="badge badge-info">${currentTechnique.category_name}</span>
                  ` : ''}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 26px; font-weight: 700; color: #38bdf8;">
                  ${currentTechnique ? currentTechnique.sessions_attended : 0}
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">Attended Sessions on this Technique</div>
              </div>
            </div>

            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="font-size: 12px; color: var(--text-muted);">
                Started: <strong>${currentTechnique ? currentTechnique.start_date : 'N/A'}</strong> | Total Career Sessions: <strong>${totalAttendedAcrossTechniques}</strong>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="app.downloadStudentCertificate(${studentId}, '${studentName.replace(/'/g, "\\'")}')">
                  <i class="fa-solid fa-certificate" style="color: #f59e0b;"></i> Certificate
                </button>
                <button class="btn btn-primary btn-sm" onclick="app.showAssignTechniqueModal(${studentId}, '${studentName.replace(/'/g, "\\'")}')">
                  <i class="fa-solid fa-arrow-up-right-dots"></i> Assign / Transition
                </button>
              </div>
            </div>
          </div>

          <!-- Assignment History Timeline -->
          <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
            <i class="fa-solid fa-clock-rotate-left"></i> Technique Assignment Timeline
          </h4>
          <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
            ${history.length === 0 ? '<p style="color: var(--text-muted); font-size: 13px;">No history recorded yet.</p>' : `
              <table class="custom-table" style="font-size: 12px;">
                <thead>
                  <tr>
                    <th>Technique</th>
                    <th>Level / Belt</th>
                    <th>Period</th>
                    <th>Sessions</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${history.map(h => `
                    <tr>
                      <td><strong>${h.technique_name}</strong></td>
                      <td>Lvl ${h.technique_level} ${h.technique_belt_level ? '• ' + h.technique_belt_level : ''}</td>
                      <td><code>${h.start_date}</code> to <code>${h.end_date || 'Present'}</code></td>
                      <td><span class="badge badge-info">${h.sessions_attended}</span></td>
                      <td>
                        <span class="badge ${h.status === 'active' ? 'badge-success' : (h.status === 'downgraded' ? 'badge-warning' : 'badge-secondary')}">
                          ${h.status}
                        </span>
                      </td>
                      <td><span style="color: var(--text-muted);">${h.remarks || '-'}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <!-- Attendance Snapshots Log -->
          <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
            <i class="fa-solid fa-camera"></i> Historical Attendance Snapshots
          </h4>
          <div style="max-height: 180px; overflow-y: auto;">
            ${snapshots.length === 0 ? '<p style="color: var(--text-muted); font-size: 13px;">No attendance snapshots recorded yet.</p>' : `
              <table class="custom-table" style="font-size: 12px;">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Batch</th>
                    <th>Practiced Technique</th>
                    <th>Progression Action</th>
                    <th>Session Count</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${snapshots.map(s => `
                    <tr>
                      <td><code>${s.attendance_date}</code></td>
                      <td>${s.batch_name}</td>
                      <td><strong>${s.technique_name}</strong> (Lvl ${s.technique_level})</td>
                      <td><span class="badge badge-purple">${s.progression_action}</span></td>
                      <td><span class="badge badge-info">${s.sessions_count_at_time}</span></td>
                      <td><span style="color: var(--text-muted);">${s.remarks || '-'}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      `,
      `<button class="btn btn-secondary" onclick="app.closeModal()">Close</button>`
    );
  },

  async showAssignTechniqueModal(studentId, studentName) {
    const techRes = await this.apiRequest('/api/academy/syllabus-techniques');
    const techniques = techRes.techniques || [];
    const today = new Date().toISOString().split('T')[0];

    this.openModal(
      `Transition Technique — ${studentName}`,
      `
        <form id="assign-tech-form">
          <div class="form-group">
            <label>Select Target Syllabus Technique *</label>
            <select id="assign-tech-id" class="form-select" style="width: 100%;" required>
              <option value="">-- Choose Technique --</option>
              ${techniques.map(t => `
                <option value="${t.id}">
                  ${t.name} (Lvl ${t.level}${t.belt_level ? ', ' + t.belt_level : ''} | Cat: ${t.category_name})
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Progression Action *</label>
              <select id="assign-action" class="form-select" style="width: 100%;">
                <option value="upgrade">Upgrade (Next Level)</option>
                <option value="downgrade">Downgrade (Refinement)</option>
                <option value="direct_jump">Direct Jump (Exam/Special)</option>
                <option value="initial">Initial Assignment</option>
              </select>
            </div>
            <div class="form-group">
              <label>Effective Date</label>
              <input type="date" id="assign-date" class="form-input" style="width: 100%;" value="${today}">
            </div>
          </div>
          <div class="form-group">
            <label>Remarks & Justification</label>
            <input type="text" id="assign-remarks" class="form-input" style="width: 100%;" placeholder="e.g. Promoted after Belt Exam, Needs stance revision">
          </div>
        </form>
      `,
      `
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.submitAssignTechnique(${studentId}, '${studentName}')">
          <i class="fa-solid fa-check"></i> Confirm Assignment
        </button>
      `
    );
  },

  async submitAssignTechnique(studentId, studentName) {
    const technique_id = document.getElementById('assign-tech-id').value;
    const action = document.getElementById('assign-action').value;
    const start_date = document.getElementById('assign-date').value;
    const remarks = document.getElementById('assign-remarks').value.trim();

    if (!technique_id) {
      this.showToast('Please select a technique', 'danger');
      return;
    }

    const res = await this.apiRequest(`/api/academy/students/${studentId}/assign-technique`, {
      method: 'POST',
      body: JSON.stringify({ technique_id, action, start_date, remarks }),
    });

    if (res.success) {
      this.showToast(res.message, 'success');
      this.showStudentTechniqueModal(studentId, studentName);
    } else {
      this.showToast(res.error || 'Failed to assign technique', 'danger');
    }
  },

  // ==========================================
  // STUDENT PORTAL TECHNIQUE VIEW
  // ==========================================

  async renderStudentTechnique() {
    const content = document.getElementById('page-content');
    content.innerHTML = '<div style="padding: 40px; text-align: center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

    const res = await this.apiRequest('/api/student/technique-history');
    if (!res.success) {
      content.innerHTML = `<div class="toast danger">${res.error}</div>`;
      return;
    }

    const { currentTechnique, history = [], totalAttendedAcrossTechniques = 0, snapshots = [] } = res;

    content.innerHTML = `
      <div class="content-card">
        <div class="card-header">
          <div>
            <h2 class="card-title"><i class="fa-solid fa-medal" style="color: #f59e0b;"></i> My Syllabus Learning & Technique Progress</h2>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Track your martial arts curriculum, belt level progression, and attended practice sessions
            </p>
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="app.downloadStudentCertificate()">
              <i class="fa-solid fa-certificate" style="color: #f59e0b;"></i> Download Belt Certificate
            </button>
          </div>
        </div>

        <div style="padding: 24px;">
          <!-- Top Hero Card -->
          <div style="background: linear-gradient(135deg, rgba(37,99,235,0.2), rgba(168,85,247,0.15)); border: 1px solid rgba(56,189,248,0.3); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div>
                <span style="font-size: 12px; text-transform: uppercase; color: #38bdf8; font-weight: 700; letter-spacing: 0.5px;">Active Training Technique</span>
                <h2 style="font-size: 24px; font-weight: 800; color: var(--text-heading); margin-top: 6px;">
                  ${currentTechnique ? currentTechnique.technique_name : 'No Technique Currently Assigned'}
                </h2>
                <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                  ${currentTechnique ? `
                    <span class="badge badge-purple" style="font-size: 12px; padding: 4px 10px;">Level ${currentTechnique.technique_level}</span>
                    ${currentTechnique.technique_belt_level ? `<span class="badge badge-warning" style="font-size: 12px; padding: 4px 10px;">${currentTechnique.technique_belt_level}</span>` : ''}
                    <span class="badge badge-info" style="font-size: 12px; padding: 4px 10px;">${currentTechnique.category_name}</span>
                  ` : ''}
                </div>
              </div>
              <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); padding: 16px 24px; text-align: center;">
                <div style="font-size: 32px; font-weight: 800; color: #10b981;">
                  ${currentTechnique ? currentTechnique.sessions_attended : 0}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-top: 2px;">
                  Attended Sessions
                </div>
              </div>
            </div>

            <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 13px; color: var(--text-muted);">
              Enrolled Since: <strong>${currentTechnique ? currentTechnique.start_date : 'N/A'}</strong> | Total Career Sessions Attended: <strong>${totalAttendedAcrossTechniques}</strong>
            </div>
          </div>

          <!-- Timeline -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px;">
              <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
                <i class="fa-solid fa-timeline" style="color: #3b82f6;"></i> Learning Progression Timeline
              </h3>
              <div class="table-responsive">
                <table class="custom-table" style="font-size: 12px;">
                  <thead>
                    <tr>
                      <th>Technique</th>
                      <th>Level / Belt</th>
                      <th>Period</th>
                      <th>Sessions</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${history.length === 0 ? '<tr><td colspan="5" style="color: var(--text-muted);">No learning history yet.</td></tr>' : history.map(h => `
                      <tr>
                        <td><strong>${h.technique_name}</strong></td>
                        <td>Lvl ${h.technique_level} ${h.technique_belt_level ? '• ' + h.technique_belt_level : ''}</td>
                        <td><code>${h.start_date}</code> to <code>${h.end_date || 'Present'}</code></td>
                        <td><span class="badge badge-info">${h.sessions_attended}</span></td>
                        <td>
                          <span class="badge ${h.status === 'active' ? 'badge-success' : 'badge-secondary'}">${h.status}</span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Attendance Snapshots -->
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px;">
              <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">
                <i class="fa-solid fa-clipboard-check" style="color: #10b981;"></i> Recent Practice Session Logs
              </h3>
              <div class="table-responsive">
                <table class="custom-table" style="font-size: 12px;">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Batch</th>
                      <th>Technique</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${snapshots.length === 0 ? '<tr><td colspan="4" style="color: var(--text-muted);">No session records yet.</td></tr>' : snapshots.slice(0, 15).map(s => `
                      <tr>
                        <td><code>${s.attendance_date}</code></td>
                        <td>${s.batch_name}</td>
                        <td><strong>${s.technique_name}</strong></td>
                        <td><span style="color: var(--text-muted);">${s.remarks || 'Practiced'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
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
