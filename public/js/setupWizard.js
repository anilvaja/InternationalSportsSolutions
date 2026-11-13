/**
 * Academy Setup Wizard Controller
 * 10-Step Guided Onboarding for Multi-Tenant Sports Academies
 */
const SetupWizardController = {
  currentStep: 1,
  totalSteps: 10,
  defaults: null,
  draft: null,

  steps: [
    { num: 1, title: 'Academy Info', icon: 'fa-building' },
    { num: 2, title: 'Administrator', icon: 'fa-user-shield' },
    { num: 3, title: 'Branches', icon: 'fa-code-branch' },
    { num: 4, title: 'Sports', icon: 'fa-medal' },
    { num: 5, title: 'Batches', icon: 'fa-layer-group' },
    { num: 6, title: 'Staff & Roles', icon: 'fa-user-ninja' },
    { num: 7, title: 'Attendance', icon: 'fa-qrcode' },
    { num: 8, title: 'Salary Policy', icon: 'fa-calculator' },
    { num: 9, title: 'Fee Structure', icon: 'fa-receipt' },
    { num: 10, title: 'Review & Launch', icon: 'fa-rocket' },
  ],

  async open(initialDraft = null) {
    if (!this.defaults) {
      try {
        const res = await window.app.apiRequest('/api/central/setup-wizard/defaults');
        if (res.success) this.defaults = res;
      } catch (e) {
        console.error('Failed to load wizard defaults:', e);
      }
    }

    // Initialize or load draft
    const saved = localStorage.getItem('iss_wizard_draft');
    this.draft = initialDraft || (saved ? JSON.parse(saved) : this.getInitialDraft());
    this.currentStep = 1;

    this.render();
  },

  getInitialDraft() {
    return {
      name: '',
      slug: '',
      code: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      currency_symbol: '₹',
      date_format: 'DD/MM/YYYY',
      plan: 'professional',
      custom_domain: '',
      is_gst_registered: false,
      gst_number: '',
      gst_rate: 18,
      legal_business_name: '',
      hsn_sac_code: '999293',

      admin_name: '',
      admin_email: '',
      admin_phone: '',
      admin_password: '',

      branches: [
        { name: 'Main Dojo / HQ', code: 'MAIN', address: 'Main Sports Complex', phone: '', geofence_radius_meters: 150, is_geofence_enforced: 1 }
      ],

      sports: [
        { name: 'Karate', code: 'KAR', description: 'Martial Arts' }
      ],

      batches: [
        { name: 'Morning Regular Batch', branch_code: 'MAIN', sport_name: 'Karate', coach_name: 'Head Coach', capacity: 30, days: ['Mon', 'Wed', 'Fri'], start_time: '06:30', end_time: '08:00' }
      ],

      employees: [
        { name: 'Head Coach', email: 'coach@academy.iss', phone: '9876543210', role: 'head_coach', compensation_mode: 'monthly', salary_amount: 35000 }
      ],

      attendance_settings: {
        is_qr_enabled: 1,
        is_face_enabled: 1,
        is_nfc_enabled: 1,
        is_gps_enabled: 1,
        is_coach_manual_enabled: 1,
        default_attendance_mode: 'qr',
        duplicate_scan_cooldown_minutes: 15,
        early_checkin_window_minutes: 30,
        late_checkin_grace_minutes: 15,
      },

      salary_settings: {
        salary_divisor_mode: 'working_days',
        custom_divisor: 26,
        overtime_multiplier: 1.0,
        auto_checkout_hours: 12,
      },

      fee_settings: {
        name: 'Regular Monthly Training Tuition',
        base_monthly_fee: 2500,
        admission_fee: 1000,
        installment_frequency: 'monthly',
        receipt_prefix: 'RCP-',
      },
    };
  },

  render() {
    const d = this.draft;
    const step = this.currentStep;

    const stepperHtml = `
      <div class="wizard-stepper-wrap" style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 12px; margin-bottom: 18px; border-bottom: 1px solid var(--border);">
        ${this.steps.map(s => {
          const isActive = s.num === step;
          const isDone = s.num < step;
          return `
            <div onclick="SetupWizardController.goToStep(${s.num})" style="flex: 1; min-width: 80px; text-align: center; cursor: pointer; padding: 6px 4px; border-radius: 6px; background: ${isActive ? 'rgba(99,102,241,0.15)' : (isDone ? 'rgba(16,185,129,0.08)' : 'transparent')}; border: 1px solid ${isActive ? 'var(--primary)' : (isDone ? '#10b981' : 'var(--border)')};">
              <div style="font-size: 11px; font-weight: 700; color: ${isActive ? 'var(--primary)' : (isDone ? '#10b981' : 'var(--text-muted)')};">
                <i class="fa-solid ${isDone ? 'fa-check' : s.icon}"></i> ${s.num}
              </div>
              <div style="font-size: 10px; color: ${isActive ? 'var(--text-heading)' : 'var(--text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
                ${s.title}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    let stepHtml = '';
    switch (step) {
      case 1: stepHtml = this.renderStep1(d); break;
      case 2: stepHtml = this.renderStep2(d); break;
      case 3: stepHtml = this.renderStep3(d); break;
      case 4: stepHtml = this.renderStep4(d); break;
      case 5: stepHtml = this.renderStep5(d); break;
      case 6: stepHtml = this.renderStep6(d); break;
      case 7: stepHtml = this.renderStep7(d); break;
      case 8: stepHtml = this.renderStep8(d); break;
      case 9: stepHtml = this.renderStep9(d); break;
      case 10: stepHtml = this.renderStep10(d); break;
    }

    const footerHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="SetupWizardController.saveDraftToStorage()">
            <i class="fa-solid fa-floppy-disk"></i> Save Draft
          </button>
        </div>
        <div style="display: flex; gap: 8px;">
          ${step > 1 ? `
            <button type="button" class="btn btn-secondary" onclick="SetupWizardController.prevStep()">
              <i class="fa-solid fa-arrow-left"></i> Previous
            </button>
          ` : `
            <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">
              Cancel
            </button>
          `}
          ${step < 10 ? `
            <button type="button" class="btn btn-primary" onclick="SetupWizardController.nextStep()">
              Next <i class="fa-solid fa-arrow-right"></i>
            </button>
          ` : `
            <button type="button" class="btn btn-primary" id="btn-launch-academy" onclick="SetupWizardController.launchAcademy()" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-weight: 700;">
              <i class="fa-solid fa-rocket"></i> Launch & Provision Academy
            </button>
          `}
        </div>
      </div>
    `;

    window.app.openModal(
      `<i class="fa-solid fa-wand-magic-sparkles" style="color: var(--primary);"></i> Guided Academy Onboarding Wizard — Step ${step} of 10: ${this.steps[step - 1].title}`,
      stepperHtml + `<div id="wizard-content" style="max-height: 60vh; overflow-y: auto; padding-right: 6px;">${stepHtml}</div>`,
      footerHtml,
      '840px'
    );
  },

  renderStep1(d) {
    return `
      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-heading);">Step 1: Academy Profile & Subscription Tier</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>Academy Name *</label>
            <input type="text" id="wiz-name" class="form-input" value="${window.app.escapeHtml(d.name)}" placeholder="e.g. Champions Martial Arts Academy" required oninput="SetupWizardController.onNameInput(this.value)">
          </div>
          <div class="form-group">
            <label>URL Slug / Subdomain *</label>
            <input type="text" id="wiz-slug" class="form-input" value="${window.app.escapeHtml(d.slug)}" placeholder="champions-martial-arts" style="font-family: monospace;" required>
            <div style="font-size: 11px; color: var(--primary); margin-top: 4px;">
              Route: <code><span id="wiz-slug-preview">${d.slug || 'slug'}</span>.internationalsportssolutions.test</code>
            </div>
          </div>
        </div>

        <div class="form-grid" style="margin-top: 10px;">
          <div class="form-group">
            <label>Subscription Plan *</label>
            <select id="wiz-plan" class="form-select">
              <option value="starter" ${d.plan === 'starter' ? 'selected' : ''}>Starter (1 Branch, 75 Students, 3 Coaches) — ₹999/mo</option>
              <option value="professional" ${d.plan === 'professional' ? 'selected' : ''}>Professional (8 Branches, 800 Students, 25 Coaches) — ₹4,999/mo</option>
              <option value="enterprise" ${d.plan === 'enterprise' ? 'selected' : ''}>Enterprise (25 Branches, 3,000 Students, 100 Coaches) — ₹9,999/mo</option>
            </select>
          </div>
          <div class="form-group">
            <label>Academy Code (3-4 Letters)</label>
            <input type="text" id="wiz-code" class="form-input" value="${window.app.escapeHtml(d.code)}" maxlength="4" placeholder="CMAA" style="text-transform: uppercase; font-family: monospace;">
          </div>
        </div>

        <div class="form-grid" style="margin-top: 10px;">
          <div class="form-group">
            <label>City & State *</label>
            <input type="text" id="wiz-city" class="form-input" value="${window.app.escapeHtml(d.city)}" placeholder="Ahmedabad, Gujarat" required>
          </div>
          <div class="form-group">
            <label>Date Format & Timezone</label>
            <div style="display: flex; gap: 8px;">
              <select id="wiz-date-format" class="form-select" style="flex: 1;">
                <option value="DD/MM/YYYY" selected>DD/MM/YYYY (Standard)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </select>
              <select id="wiz-timezone" class="form-select" style="flex: 1;">
                <option value="Asia/Kolkata" selected>Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 12px;">
          <label>Branded Custom Domain (Optional)</label>
          <input type="text" id="wiz-custom-domain" class="form-input" value="${window.app.escapeHtml(d.custom_domain)}" placeholder="e.g. championsacademy.in">
        </div>
      </div>
    `;
  },

  renderStep2(d) {
    return `
      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-heading);">Step 2: Designated Academy Administrator</h4>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">The initial administrative account responsible for daily academy operations, coach onboarding, and fee management.</p>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Administrator Full Name *</label>
            <input type="text" id="wiz-admin-name" class="form-input" value="${window.app.escapeHtml(d.admin_name || (d.name ? d.name + ' Admin' : ''))}" required placeholder="e.g. Rajesh Sharma">
          </div>
          <div class="form-group">
            <label>Login Email Address *</label>
            <input type="email" id="wiz-admin-email" class="form-input" value="${window.app.escapeHtml(d.admin_email)}" required placeholder="admin@academy.com">
          </div>
        </div>

        <div class="form-grid" style="margin-top: 10px;">
          <div class="form-group">
            <label>Contact Phone / Mobile</label>
            <input type="text" id="wiz-admin-phone" class="form-input" value="${window.app.escapeHtml(d.admin_phone)}" placeholder="9876543210">
          </div>
          <div class="form-group">
            <label>Initial Secure Password *</label>
            <input type="password" id="wiz-admin-password" class="form-input" value="${window.app.escapeHtml(d.admin_password || 'Admin@12345')}" required placeholder="••••••••">
          </div>
        </div>

        <div style="background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.2); border-radius: 8px; padding: 12px; margin-top: 14px;">
          <i class="fa-solid fa-shield-halved" style="color: var(--primary);"></i>
          <span style="font-size: 12px; font-weight: 600; color: var(--text-heading); margin-left: 6px;">Role Assignment: <code>academy_admin</code></span>
          <p style="font-size: 11px; color: var(--text-muted); margin: 4px 0 0 0;">This account is registered in both the tenant user registry and central authentication lookup, granting immediate full administrative privileges.</p>
        </div>
      </div>
    `;
  },

  renderStep3(d) {
    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-size: 14px; font-weight: 700; margin: 0; color: var(--text-heading);">Step 3: Training Branches & Dojos (${d.branches.length})</h4>
          <button type="button" class="btn btn-primary btn-sm" onclick="SetupWizardController.addBranchRow()">
            <i class="fa-solid fa-plus"></i> Add Branch
          </button>
        </div>

        <div id="wiz-branches-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${d.branches.map((b, idx) => `
            <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--surface-hover);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: var(--text-heading);">Branch #${idx + 1}</span>
                ${d.branches.length > 1 ? `
                  <button type="button" class="btn btn-outline-danger btn-sm" style="padding: 2px 6px; font-size: 11px;" onclick="SetupWizardController.removeBranchRow(${idx})">
                    <i class="fa-solid fa-trash"></i> Remove
                  </button>
                ` : '<span style="font-size: 10px; color: var(--text-dim);">Primary Branch</span>'}
              </div>
              <div class="form-grid">
                <input type="text" class="form-input wiz-branch-name" value="${window.app.escapeHtml(b.name)}" placeholder="Branch Name (e.g. Navrangpura Main Dojo)" required>
                <input type="text" class="form-input wiz-branch-code" value="${window.app.escapeHtml(b.code)}" placeholder="Code (e.g. NAV-01)" style="font-family: monospace;">
              </div>
              <div class="form-grid" style="margin-top: 8px;">
                <input type="text" class="form-input wiz-branch-address" value="${window.app.escapeHtml(b.address)}" placeholder="Physical Address">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <input type="number" class="form-input wiz-branch-radius" value="${b.geofence_radius_meters || 150}" placeholder="Geofence (meters)" style="width: 120px;">
                  <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                    <input type="checkbox" class="wiz-branch-geofence" ${b.is_geofence_enforced ? 'checked' : ''}> GPS Geofenced
                  </label>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderStep4(d) {
    const sportsList = (this.defaults && this.defaults.standardSports) || [
      { name: 'Karate', code: 'KAR', description: 'Martial Arts' },
      { name: 'Taekwondo', code: 'TKD', description: 'Martial Arts' },
      { name: 'Boxing', code: 'BOX', description: 'Combat Sport' },
      { name: 'Football', code: 'FTB', description: 'Team Sport' },
      { name: 'Cricket', code: 'CRK', description: 'Team Sport' },
      { name: 'Swimming', code: 'SWM', description: 'Aquatics' },
      { name: 'Badminton', code: 'BAD', description: 'Racket Sport' },
      { name: 'Yoga', code: 'YOG', description: 'Mindfulness & Conditioning' },
    ];

    const currentSelected = d.sports.map(s => (typeof s === 'string' ? s : s.name).toLowerCase());

    return `
      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-heading);">Step 4: Sports & Syllabus Disciplines</h4>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">Select the primary sports disciplines offered by this academy. Standard progressive syllabus categories will be attached automatically.</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
          ${sportsList.map(sp => {
            const isChecked = currentSelected.includes(sp.name.toLowerCase());
            return `
              <label style="display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}; border-radius: 8px; background: ${isChecked ? 'rgba(99,102,241,0.08)' : 'var(--surface-hover)'}; cursor: pointer;">
                <input type="checkbox" class="wiz-sport-checkbox" value="${sp.name}" ${isChecked ? 'checked' : ''} onchange="SetupWizardController.toggleSport('${sp.name}', this.checked)" style="margin-top: 3px;">
                <div>
                  <div style="font-size: 13px; font-weight: 700; color: var(--text-heading);">${sp.name}</div>
                  <div style="font-size: 10px; color: var(--text-muted);">${sp.description || ''}</div>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  renderStep5(d) {
    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-size: 14px; font-weight: 700; margin: 0; color: var(--text-heading);">Step 5: Batches & Timetables (${d.batches.length})</h4>
          <button type="button" class="btn btn-primary btn-sm" onclick="SetupWizardController.addBatchRow()">
            <i class="fa-solid fa-plus"></i> Add Batch
          </button>
        </div>

        <div id="wiz-batches-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${d.batches.map((b, idx) => `
            <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--surface-hover);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: var(--text-heading);">Batch #${idx + 1}</span>
                ${d.batches.length > 1 ? `
                  <button type="button" class="btn btn-outline-danger btn-sm" style="padding: 2px 6px; font-size: 11px;" onclick="SetupWizardController.removeBatchRow(${idx})">
                    <i class="fa-solid fa-trash"></i> Remove
                  </button>
                ` : ''}
              </div>
              <div class="form-grid">
                <input type="text" class="form-input wiz-batch-name" value="${window.app.escapeHtml(b.name)}" placeholder="Batch Name (e.g. Elite Evening Batch)" required>
                <input type="number" class="form-input wiz-batch-capacity" value="${b.capacity || 30}" placeholder="Capacity (e.g. 30)" style="width: 100%;">
              </div>
              <div class="form-grid" style="margin-top: 8px;">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <span style="font-size: 11px; color: var(--text-muted);">Start:</span>
                  <input type="time" class="form-input wiz-batch-start" value="${b.start_time || '06:30'}" style="flex: 1;">
                  <span style="font-size: 11px; color: var(--text-muted);">End:</span>
                  <input type="time" class="form-input wiz-batch-end" value="${b.end_time || '08:00'}" style="flex: 1;">
                </div>
                <input type="text" class="form-input wiz-batch-days" value="${Array.isArray(b.days) ? b.days.join(',') : (b.days || 'Mon,Wed,Fri')}" placeholder="Days (Mon,Wed,Fri)">
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderStep6(d) {
    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-size: 14px; font-weight: 700; margin: 0; color: var(--text-heading);">Step 6: Staff Members & Coaches (${d.employees.length})</h4>
          <button type="button" class="btn btn-primary btn-sm" onclick="SetupWizardController.addEmployeeRow()">
            <i class="fa-solid fa-plus"></i> Add Staff Member
          </button>
        </div>

        <div id="wiz-employees-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${d.employees.map((e, idx) => `
            <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--surface-hover);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: var(--text-heading);">Employee #${idx + 1}</span>
                <button type="button" class="btn btn-outline-danger btn-sm" style="padding: 2px 6px; font-size: 11px;" onclick="SetupWizardController.removeEmployeeRow(${idx})">
                  <i class="fa-solid fa-trash"></i> Remove
                </button>
              </div>
              <div class="form-grid">
                <input type="text" class="form-input wiz-emp-name" value="${window.app.escapeHtml(e.name)}" placeholder="Full Name (e.g. Vikramaditya Rathore)" required>
                <input type="email" class="form-input wiz-emp-email" value="${window.app.escapeHtml(e.email)}" placeholder="Staff Email Address" required>
              </div>
              <div class="form-grid" style="margin-top: 8px;">
                <select class="form-select wiz-emp-role">
                  <option value="head_coach" ${e.role === 'head_coach' ? 'selected' : ''}>Branch Head Coach</option>
                  <option value="coach" ${e.role === 'coach' ? 'selected' : ''}>Coach</option>
                  <option value="trainer" ${e.role === 'trainer' ? 'selected' : ''}>Trainer</option>
                  <option value="branch_admin" ${e.role === 'branch_admin' ? 'selected' : ''}>Branch Admin</option>
                  <option value="staff" ${e.role === 'staff' ? 'selected' : ''}>Other Staff</option>
                </select>
                <div style="display: flex; gap: 8px;">
                  <select class="form-select wiz-emp-comp" style="width: 140px;">
                    <option value="monthly" ${e.compensation_mode === 'monthly' ? 'selected' : ''}>Monthly</option>
                    <option value="daily" ${e.compensation_mode === 'daily' ? 'selected' : ''}>Daily</option>
                    <option value="hourly" ${e.compensation_mode === 'hourly' ? 'selected' : ''}>Hourly</option>
                  </select>
                  <input type="number" class="form-input wiz-emp-salary" value="${e.salary_amount || 25000}" placeholder="Salary / Rate" style="flex: 1;">
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderStep7(d) {
    const att = d.attendance_settings || {};
    return `
      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-heading);">Step 7: Smart Attendance Engine Configuration</h4>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-bottom: 16px;">
          <label style="display: flex; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-hover); cursor: pointer;">
            <input type="checkbox" id="wiz-att-qr" ${att.is_qr_enabled ? 'checked' : ''}>
            <div>
              <div style="font-size: 13px; font-weight: 700;"><i class="fa-solid fa-qrcode" style="color: var(--primary);"></i> QR Code Scanning</div>
              <div style="font-size: 11px; color: var(--text-muted);">Cryptographic student passes</div>
            </div>
          </label>
          <label style="display: flex; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-hover); cursor: pointer;">
            <input type="checkbox" id="wiz-att-manual" ${att.is_coach_manual_enabled ? 'checked' : ''}>
            <div>
              <div style="font-size: 13px; font-weight: 700;"><i class="fa-solid fa-clipboard-user" style="color: #10b981;"></i> Coach Manual Roster</div>
              <div style="font-size: 11px; color: var(--text-muted);">In-field batch attendance</div>
            </div>
          </label>
          <label style="display: flex; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-hover); cursor: pointer;">
            <input type="checkbox" id="wiz-att-face" ${att.is_face_enabled ? 'checked' : ''}>
            <div>
              <div style="font-size: 13px; font-weight: 700;"><i class="fa-solid fa-user-shield" style="color: #8b5cf6;"></i> Face Biometrics</div>
              <div style="font-size: 11px; color: var(--text-muted);">AES-256 with parental consent</div>
            </div>
          </label>
          <label style="display: flex; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-hover); cursor: pointer;">
            <input type="checkbox" id="wiz-att-gps" ${att.is_gps_enabled ? 'checked' : ''}>
            <div>
              <div style="font-size: 13px; font-weight: 700;"><i class="fa-solid fa-location-dot" style="color: #ec4899;"></i> GPS Geofencing</div>
              <div style="font-size: 11px; color: var(--text-muted);">Location radius verification</div>
            </div>
          </label>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Duplicate Scan Cooldown (Minutes)</label>
            <input type="number" id="wiz-att-cooldown" class="form-input" value="${att.duplicate_scan_cooldown_minutes || 15}">
          </div>
          <div class="form-group">
            <label>Late Arrival Grace Period (Minutes)</label>
            <input type="number" id="wiz-att-grace" class="form-input" value="${att.late_checkin_grace_minutes || 15}">
          </div>
        </div>
      </div>
    `;
  },

  renderStep8(d) {
    const sal = d.salary_settings || {};
    return `
      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-heading);">Step 8: Staff Salary Divisor & Payroll Policies</h4>
        
        <div class="form-group">
          <label>Monthly Salary Divisor Mode *</label>
          <select id="wiz-sal-divisor" class="form-select">
            <option value="working_days" ${sal.salary_divisor_mode === 'working_days' ? 'selected' : ''}>Scheduled Working Days (Recommended: Monthly Base / Actual Working Days in Month)</option>
            <option value="calendar_days" ${sal.salary_divisor_mode === 'calendar_days' ? 'selected' : ''}>Total Calendar Days (Monthly Base / 30 or 31)</option>
            <option value="custom_days" ${sal.salary_divisor_mode === 'custom_days' ? 'selected' : ''}>Custom Fixed Divisor (e.g. Exactly 26 Days)</option>
          </select>
        </div>

        <div class="form-grid" style="margin-top: 10px;">
          <div class="form-group">
            <label>Overtime Pay Multiplier</label>
            <input type="number" step="0.1" id="wiz-sal-overtime" class="form-input" value="${sal.overtime_multiplier || 1.0}" placeholder="1.0">
          </div>
          <div class="form-group">
            <label>Shift Auto-Checkout Max Hours</label>
            <input type="number" id="wiz-sal-autoclose" class="form-input" value="${sal.auto_checkout_hours || 12}">
          </div>
        </div>
      </div>
    `;
  },

  renderStep9(d) {
    const fee = d.fee_settings || {};
    return `
      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-heading);">Step 9: Fees & Tuition Structure</h4>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Base Monthly Tuition Fee (₹) *</label>
            <input type="number" id="wiz-fee-amount" class="form-input" value="${fee.base_monthly_fee || 2500}" required>
          </div>
          <div class="form-group">
            <label>One-Time Admission / Registration Fee (₹)</label>
            <input type="number" id="wiz-fee-admission" class="form-input" value="${fee.admission_fee || 1000}">
          </div>
        </div>

        <div class="form-grid" style="margin-top: 10px;">
          <div class="form-group">
            <label>Fee Plan Display Name</label>
            <input type="text" id="wiz-fee-name" class="form-input" value="${window.app.escapeHtml(fee.name || 'Regular Monthly Training Tuition')}">
          </div>
          <div class="form-group">
            <label>Receipt Number Prefix</label>
            <input type="text" id="wiz-fee-prefix" class="form-input" value="${window.app.escapeHtml(fee.receipt_prefix || 'RCP-')}" style="font-family: monospace;">
          </div>
        </div>
      </div>
    `;
  },

  renderStep10(d) {
    return `
      <div>
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-heading);">Step 10: Complete Configuration Review & Launch</h4>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">Review your comprehensive academy configuration. Once launched, an isolated SQLite database is created, migrations applied, and the administrative portal will be ready immediately.</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 18px;">
          <div style="background: var(--surface-hover); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Academy & Domain</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--primary); margin-top: 4px;">${d.name || 'Untitled Academy'}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;"><code>${d.slug}.internationalsportssolutions.test</code></div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Plan: <strong>${d.plan.toUpperCase()}</strong></div>
          </div>

          <div style="background: var(--surface-hover); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Admin Account</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-heading); margin-top: 4px;">${d.admin_name || 'Admin'}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${d.admin_email || 'No email provided'}</div>
            <div style="font-size: 11px; color: #10b981; margin-top: 2px;"><i class="fa-solid fa-key"></i> Password configured</div>
          </div>

          <div style="background: var(--surface-hover); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Operations</div>
            <div style="font-size: 13px; font-weight: 600; margin-top: 4px;">${d.branches.length} Branches &bull; ${d.batches.length} Batches</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Staff: ${d.employees.length} onboarded</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Sports: ${d.sports.map(s => typeof s === 'string' ? s : s.name).join(', ')}</div>
          </div>
        </div>

        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #10b981;">
            <i class="fa-solid fa-circle-check"></i> Operational Readiness Checklist (100% Complete)
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            All prerequisites satisfied. Clicking "Launch & Provision Academy" will create <code>data/academies/academy_${d.slug}.db</code> with standard 8 roles, branches, schedules, and payroll parameters.
          </div>
        </div>
      </div>
    `;
  },

  onNameInput(name) {
    const slugInput = document.getElementById('wiz-slug');
    const preview = document.getElementById('wiz-slug-preview');
    if (!slugInput) return;
    const autoSlug = (name || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    slugInput.value = autoSlug;
    if (preview) preview.innerText = autoSlug || 'slug';
  },

  saveCurrentStepInputs() {
    const d = this.draft;
    const step = this.currentStep;

    if (step === 1) {
      d.name = document.getElementById('wiz-name')?.value?.trim() || d.name;
      d.slug = document.getElementById('wiz-slug')?.value?.trim() || d.slug;
      d.code = document.getElementById('wiz-code')?.value?.trim() || d.code;
      d.plan = document.getElementById('wiz-plan')?.value || d.plan;
      d.city = document.getElementById('wiz-city')?.value?.trim() || d.city;
      d.custom_domain = document.getElementById('wiz-custom-domain')?.value?.trim() || '';
    } else if (step === 2) {
      d.admin_name = document.getElementById('wiz-admin-name')?.value?.trim() || d.admin_name;
      d.admin_email = document.getElementById('wiz-admin-email')?.value?.trim() || d.admin_email;
      d.admin_phone = document.getElementById('wiz-admin-phone')?.value?.trim() || d.admin_phone;
      d.admin_password = document.getElementById('wiz-admin-password')?.value || d.admin_password;
    } else if (step === 3) {
      const names = document.querySelectorAll('.wiz-branch-name');
      const codes = document.querySelectorAll('.wiz-branch-code');
      const addrs = document.querySelectorAll('.wiz-branch-address');
      const rads = document.querySelectorAll('.wiz-branch-radius');
      const geos = document.querySelectorAll('.wiz-branch-geofence');
      d.branches = [];
      names.forEach((nEl, i) => {
        d.branches.push({
          name: nEl.value.trim() || `Branch #${i + 1}`,
          code: codes[i]?.value?.trim() || `BR-${i + 1}`,
          address: addrs[i]?.value?.trim() || '',
          geofence_radius_meters: Number(rads[i]?.value || 150),
          is_geofence_enforced: geos[i]?.checked ? 1 : 0,
        });
      });
    } else if (step === 7) {
      d.attendance_settings = {
        is_qr_enabled: document.getElementById('wiz-att-qr')?.checked ? 1 : 0,
        is_coach_manual_enabled: document.getElementById('wiz-att-manual')?.checked ? 1 : 0,
        is_face_enabled: document.getElementById('wiz-att-face')?.checked ? 1 : 0,
        is_gps_enabled: document.getElementById('wiz-att-gps')?.checked ? 1 : 0,
        duplicate_scan_cooldown_minutes: Number(document.getElementById('wiz-att-cooldown')?.value || 15),
        late_checkin_grace_minutes: Number(document.getElementById('wiz-att-grace')?.value || 15),
      };
    } else if (step === 8) {
      d.salary_settings = {
        salary_divisor_mode: document.getElementById('wiz-sal-divisor')?.value || 'working_days',
        overtime_multiplier: Number(document.getElementById('wiz-sal-overtime')?.value || 1.0),
        auto_checkout_hours: Number(document.getElementById('wiz-sal-autoclose')?.value || 12),
      };
    } else if (step === 9) {
      d.fee_settings = {
        base_monthly_fee: Number(document.getElementById('wiz-fee-amount')?.value || 2500),
        admission_fee: Number(document.getElementById('wiz-fee-admission')?.value || 1000),
        name: document.getElementById('wiz-fee-name')?.value?.trim() || 'Regular Monthly Training Tuition',
        receipt_prefix: document.getElementById('wiz-fee-prefix')?.value?.trim() || 'RCP-',
      };
    }

    localStorage.setItem('iss_wizard_draft', JSON.stringify(d));
  },

  nextStep() {
    this.saveCurrentStepInputs();
    if (this.currentStep === 1 && (!this.draft.name || !this.draft.slug)) {
      window.app.showToast('Please enter academy name and slug', 'warning');
      return;
    }
    if (this.currentStep === 2 && (!this.draft.admin_email || !this.draft.admin_password)) {
      window.app.showToast('Please enter administrator email and password', 'warning');
      return;
    }
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.render();
    }
  },

  prevStep() {
    this.saveCurrentStepInputs();
    if (this.currentStep > 1) {
      this.currentStep--;
      this.render();
    }
  },

  goToStep(num) {
    this.saveCurrentStepInputs();
    this.currentStep = num;
    this.render();
  },

  toggleSport(sportName, isChecked) {
    const list = this.draft.sports.map(s => typeof s === 'string' ? s : s.name);
    if (isChecked && !list.includes(sportName)) {
      this.draft.sports.push({ name: sportName, code: sportName.substring(0, 3).toUpperCase() });
    } else if (!isChecked) {
      this.draft.sports = this.draft.sports.filter(s => (typeof s === 'string' ? s : s.name) !== sportName);
    }
  },

  addBranchRow() {
    this.saveCurrentStepInputs();
    const count = this.draft.branches.length + 1;
    this.draft.branches.push({
      name: `Branch Dojo #${count}`,
      code: `BR-${count}`,
      address: '',
      geofence_radius_meters: 150,
      is_geofence_enforced: 1,
    });
    this.render();
  },

  removeBranchRow(index) {
    this.saveCurrentStepInputs();
    this.draft.branches.splice(index, 1);
    this.render();
  },

  addBatchRow() {
    this.saveCurrentStepInputs();
    this.draft.batches.push({
      name: 'Evening Regular Batch',
      branch_code: 'MAIN',
      sport_name: 'Karate',
      capacity: 30,
      days: ['Tue', 'Thu', 'Sat'],
      start_time: '18:00',
      end_time: '19:30',
    });
    this.render();
  },

  removeBatchRow(index) {
    this.saveCurrentStepInputs();
    this.draft.batches.splice(index, 1);
    this.render();
  },

  addEmployeeRow() {
    this.saveCurrentStepInputs();
    const count = this.draft.employees.length + 1;
    this.draft.employees.push({
      name: `Assistant Coach #${count}`,
      email: `coach${count}@academy.iss`,
      phone: '',
      role: 'coach',
      compensation_mode: 'monthly',
      salary_amount: 25000,
    });
    this.render();
  },

  removeEmployeeRow(index) {
    this.saveCurrentStepInputs();
    this.draft.employees.splice(index, 1);
    this.render();
  },

  saveDraftToStorage() {
    this.saveCurrentStepInputs();
    window.app.showToast('Setup wizard draft saved locally!', 'success');
  },

  async launchAcademy() {
    this.saveCurrentStepInputs();
    const btn = document.getElementById('btn-launch-academy');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Provisioning Academy Database & Workflows...';
    }

    try {
      window.app.showToast('Executing 10-step transactional provisioning...', 'info');
      const res = await window.app.apiRequest('/api/central/setup-wizard/create', {
        method: 'POST',
        body: JSON.stringify(this.draft),
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to provision academy');
      }

      localStorage.removeItem('iss_wizard_draft');
      window.app.closeModal();

      // Show Launch Success Dialog
      const academy = res.academy;
      const completeness = res.completeness || {};

      window.app.openModal(
        '<i class="fa-solid fa-champagne-glasses" style="color: #10b981;"></i> Academy Successfully Launched!',
        `
          <div style="text-align: center; padding: 20px 10px;">
            <div style="font-size: 48px; color: #10b981; margin-bottom: 12px;"><i class="fa-solid fa-circle-check"></i></div>
            <h3 style="font-size: 20px; font-weight: 800; color: var(--text-heading); margin-bottom: 6px;">${academy.name} is Live!</h3>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
              Physical SQLite database <code>academy_${academy.id}.db</code> has been created with all 10 modules configured (${completeness.score}% operational score).
            </p>

            <div style="background: var(--surface-hover); border: 1px solid var(--border); border-radius: 8px; padding: 14px; text-align: left; margin-bottom: 20px; font-size: 13px;">
              <div style="margin-bottom: 6px;"><strong>Subdomain:</strong> <code>${academy.primaryDomain}</code></div>
              <div style="margin-bottom: 6px;"><strong>Administrator:</strong> <code>${this.draft.admin_email}</code></div>
              <div><strong>Setup Completeness:</strong> <span class="badge badge-success">${completeness.score}% Ready</span></div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center;">
              <button class="btn btn-secondary" onclick="window.app.closeModal()">Close</button>
              <button class="btn btn-primary" onclick="window.app.closeModal(); window.app.switchAcademy(${academy.id}); window.app.navigate('overview');">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Academy Portal
              </button>
            </div>
          </div>
        `,
        '',
        '600px'
      );

      if (window.app.currentTab === 'central-academies') {
        window.app.renderCentralAcademies();
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Launch & Provision Academy';
      }
      window.app.showToast(err.message, 'danger');
    }
  }
};

window.SetupWizardController = SetupWizardController;

