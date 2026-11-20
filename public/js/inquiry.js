/**
 * Public Student Self-Service Admission Inquiry & Registration
 * International Sports Solutions
 */

document.addEventListener('DOMContentLoaded', () => {
  let metaData = null;
  let allBatches = [];

  const urlParams = new URLSearchParams(window.location.search);
  const academyParam = urlParams.get('academy') || urlParams.get('slug') || '';
  const academyIdParam = urlParams.get('academy_id') || urlParams.get('id') || '';
  const isQrSource = urlParams.get('qr') === '1' || urlParams.get('source') === 'qr_code';

  const brandContainer = document.getElementById('academy-brand-container');
  const brandLogoArea = document.getElementById('brand-logo-area');
  const academyTitle = document.getElementById('academy-title');
  const academySubtitle = document.getElementById('academy-subtitle');
  const academyContactChips = document.getElementById('academy-contact-chips');
  const selectorCard = document.getElementById('academy-selector-card');
  const selectActiveAcademy = document.getElementById('select-active-academy');
  const formCard = document.getElementById('inquiry-form');
  const successCard = document.getElementById('inquiry-success-card');
  const btnSubmit = document.getElementById('btn-submit-inquiry');

  const inqSource = document.getElementById('inq-source');
  const inqAcademyId = document.getElementById('inq-academy-id');
  const inqAcademySlug = document.getElementById('inq-academy-slug');
  const inqBranch = document.getElementById('inq-branch');
  const inqSport = document.getElementById('inq-sport');
  const inqBatch = document.getElementById('inq-batch');

  if (isQrSource) {
    inqSource.value = 'qr_code';
  }

  // Load Academy Form Meta
  loadInquiryMeta(academyParam, academyIdParam);

  async function loadInquiryMeta(slug, id) {
    try {
      let query = '';
      if (id) query = `?academy_id=${encodeURIComponent(id)}`;
      else if (slug) query = `?academy=${encodeURIComponent(slug)}`;

      const res = await fetch(`/api/public/inquiry-form-meta${query}`);
      const data = await res.json();

      if (!data.success) {
        showToast(data.error || 'Failed to load admission form metadata', 'error');
        return;
      }

      metaData = data;

      if (data.needsAcademySelection) {
        if (data.academies && data.academies.length === 1) {
          // Auto-select the only available academy directly!
          loadInquiryMeta(data.academies[0].slug, null);
          return;
        }
        showAcademySelector(data.academies);
      } else {
        renderAcademyForm(data);
      }
    } catch (err) {
      console.error('Error loading inquiry metadata:', err);
      showToast('Connection error. Please refresh and try again.', 'error');
    }
  }

  function showAcademySelector(academies) {
    selectorCard.style.display = 'block';
    formCard.style.display = 'none';
    selectActiveAcademy.innerHTML = '<option value="">-- Choose Sports Academy --</option>';

    academies.forEach(ac => {
      const opt = document.createElement('option');
      opt.value = ac.slug;
      opt.textContent = `${ac.name} (${ac.city || 'India'})`;
      selectActiveAcademy.appendChild(opt);
    });

    selectActiveAcademy.onchange = () => {
      const selectedSlug = selectActiveAcademy.value;
      if (selectedSlug) {
        loadInquiryMeta(selectedSlug, null);
      }
    };
  }

  function renderAcademyForm(data) {
    selectorCard.style.display = 'none';
    formCard.style.display = 'block';

    const ac = data.academy;
    inqAcademyId.value = ac.id;
    inqAcademySlug.value = ac.slug;

    // Set Branding
    academyTitle.textContent = ac.name;
    academySubtitle.textContent = `Online student registration & admission portal for ${ac.name}. Submit your details for instant admission review and trial scheduling.`;

    if (ac.logo_url) {
      brandLogoArea.innerHTML = `<img src="${escapeHtml(ac.logo_url)}" alt="${escapeHtml(ac.name)}" class="academy-logo-img">`;
    } else {
      const initials = ac.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
      brandLogoArea.innerHTML = `<div class="academy-logo-placeholder">${initials || '<i class="fa-solid fa-graduation-cap"></i>'}</div>`;
    }

    // Contact chips
    let chipsHtml = '';
    if (ac.contact_phone) {
      chipsHtml += `<span style="font-size: 13px; color: #cbd5e1; background: rgba(255,255,255,0.06); padding: 4px 12px; border-radius: 20px;"><i class="fa-solid fa-phone" style="color: #38bdf8; margin-right: 6px;"></i>${escapeHtml(ac.contact_phone)}</span>`;
    }
    if (ac.city) {
      chipsHtml += `<span style="font-size: 13px; color: #cbd5e1; background: rgba(255,255,255,0.06); padding: 4px 12px; border-radius: 20px;"><i class="fa-solid fa-location-dot" style="color: #10b981; margin-right: 6px;"></i>${escapeHtml(ac.city)}</span>`;
    }
    academyContactChips.innerHTML = chipsHtml;

    // Branches
    const branchParam = urlParams.get('branch') || urlParams.get('branch_id');
    inqBranch.innerHTML = '<option value="">-- Any / Nearest Dojo / Branch --</option>';
    let branchMatched = false;
    if (data.branches && data.branches.length > 0) {
      data.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.name}${b.city ? ' (' + b.city + ')' : ''}`;
        if (branchParam && (String(b.id) === String(branchParam) || b.name.toLowerCase().includes(String(branchParam).toLowerCase()))) {
          opt.selected = true;
          branchMatched = true;
        }
        inqBranch.appendChild(opt);
      });
      if (!branchMatched && data.branches.length === 1) {
        inqBranch.value = data.branches[0].id;
      }
    }

    // Sports
    inqSport.innerHTML = '<option value="">-- Select Sport --</option>';
    if (data.sports && data.sports.length > 0) {
      data.sports.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        inqSport.appendChild(opt);
      });
      if (data.sports.length === 1) {
        inqSport.value = data.sports[0].id;
      }
    }

    allBatches = data.batches || [];
    filterBatches();

    inqBranch.onchange = filterBatches;
    inqSport.onchange = filterBatches;
  }

  function filterBatches() {
    const selectedBranchId = inqBranch.value ? Number(inqBranch.value) : null;
    const selectedSportId = inqSport.value ? Number(inqSport.value) : null;

    inqBatch.innerHTML = '<option value="">-- Flexible / Any Batch --</option>';

    const filtered = allBatches.filter(b => {
      if (selectedBranchId && b.branch_id !== selectedBranchId) return false;
      if (selectedSportId && b.sport_id !== selectedSportId) return false;
      return true;
    });

    if (filtered.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '-- No specific batches listed (Staff will assign) --';
      inqBatch.appendChild(opt);
      return;
    }

    filtered.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      let label = b.name;
      if (b.days_of_week) label += ` (${b.days_of_week})`;
      if (b.start_time && b.end_time) label += ` [${b.start_time} - ${b.end_time}]`;
      opt.textContent = label;
      inqBatch.appendChild(opt);
    });
  }

  // Handle Form Submission
  formCard.addEventListener('submit', async (e) => {
    e.preventDefault();

    const studentName = document.getElementById('inq-student-name').value.trim();
    const phone = document.getElementById('inq-phone').value.trim();

    if (!studentName) {
      showToast('Please enter the student\'s name', 'error');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showToast('Please provide a valid 10-digit mobile phone number', 'error');
      return;
    }

    const payload = {
      academy_id: inqAcademyId.value,
      academy_slug: inqAcademySlug.value,
      source: inqSource.value || 'online',
      student_name: studentName,
      date_of_birth: document.getElementById('inq-dob').value || null,
      gender: document.getElementById('inq-gender').value,
      phone: phone,
      email: document.getElementById('inq-email').value.trim() || null,
      guardian_name: document.getElementById('inq-guardian-name').value.trim() || null,
      guardian_relation: document.getElementById('inq-guardian-relation').value,
      branch_id: inqBranch.value || null,
      sport_id: inqSport.value || null,
      preferred_batch_id: inqBatch.value || null,
      notes: document.getElementById('inq-notes').value.trim() || null
    };

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting Inquiry...';

    try {
      const res = await fetch('/api/public/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!result.success) {
        showToast(result.error || 'Failed to submit inquiry', 'error');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Admission Inquiry';
        return;
      }

      // Show Success Card
      formCard.style.display = 'none';
      successCard.style.display = 'block';

      document.getElementById('succ-ref-no').textContent = `#${result.inquiry.reference_no}`;
      document.getElementById('succ-student-name').textContent = result.inquiry.student_name;
      document.getElementById('succ-academy-name').textContent = result.academy.name;

      // Setup WhatsApp Action Button
      const academyPhone = (result.academy.contact_phone || '').replace(/\D/g, '');
      const btnWa = document.getElementById('btn-whatsapp-academy');

      const waText = encodeURIComponent(
        `Hello ${result.academy.name}! I have submitted an admission inquiry for ${result.inquiry.student_name} (Reference #${result.inquiry.reference_no}). Could you please share the batch schedule, trial timing, and enrollment details?`
      );

      if (academyPhone) {
        btnWa.href = `https://wa.me/91${academyPhone.slice(-10)}?text=${waText}`;
      } else {
        btnWa.href = `https://wa.me/?text=${waText}`;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error('Submission error:', err);
      showToast('Network error while submitting. Please try again.', 'error');
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Admission Inquiry';
    }
  });

  // Handle "Submit Another Inquiry"
  document.getElementById('btn-new-inquiry').addEventListener('click', () => {
    formCard.reset();
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Admission Inquiry';
    successCard.style.display = 'none';
    formCard.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
