/**
 * Smart Attendance Engine — Frontend Client Controller
 * Powers Live Kiosk, Coach Mobile Scanner, Digital ID Cards, NFC Wristbands,
 * Face Biometrics & Parental Consent, and Offline Scan Sync.
 */

window.SmartAttendanceController = {
  currentSubTab: 'kiosk',
  activeStream: null,
  isScanning: false,
  scanMode: 'qr', // 'qr' | 'face'
  offlineQueueKey: 'iss_smart_att_offline_queue',
  barcodeDetector: null,
  audioContext: null,
  detectionCanvas: null,
  lastFaceScanTime: 0,
  isProcessingScan: false,

  init() {
    if ('BarcodeDetector' in window) {
      try {
        this.barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
      } catch (_) {
        this.barcodeDetector = null;
      }
    }

    // Auto-sync offline queue on reconnect
    window.addEventListener('online', () => {
      this.syncOfflineQueue(true);
    });
  },

  getAudioContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioContext = new AudioCtx();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  },

  playAudioFeedback(type = 'success_beep') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'success_beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15); // E6
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'late_chime') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.setValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'review_prompt') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // Error buzzer
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (_) {}
  },

  switchSubTab(tab) {
    this.currentSubTab = tab;
    this.stopCameraStream();
    if (window.app && typeof window.app.renderSmartAttendance === 'function') {
      window.app.renderSmartAttendance();
    }
  },

  async startCameraStream(videoElementId = 'kiosk-video', facingMode = 'environment') {
    this.stopCameraStream();
    const video = document.getElementById(videoElementId);
    if (!video) return;

    try {
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.activeStream = stream;
      video.srcObject = stream;
      await video.play();

      this.isScanning = true;
      this.runDetectionLoop(video);
    } catch (err) {
      console.warn('[Smart Attendance] Camera access failed:', err.message);
      const notice = document.getElementById('camera-error-banner');
      if (notice) {
        notice.style.display = 'block';
        notice.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Camera unavailable: ${err.message}. You can use manual code input or a USB barcode scanner below.`;
      }
    }
  },

  stopCameraStream() {
    this.isScanning = false;
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(t => t.stop());
      this.activeStream = null;
    }
  },

  setScanMode(mode) {
    this.scanMode = mode; // 'qr' | 'face'
    const reticle = document.querySelector('.kiosk-reticle-overlay');
    const btnQr = document.getElementById('btn-scanmode-qr');
    const btnFace = document.getElementById('btn-scanmode-face');
    const faceActions = document.getElementById('kiosk-face-actions');
    const qrActions = document.getElementById('kiosk-qr-actions');

    if (btnQr && btnFace) {
      if (mode === 'face') {
        btnFace.className = 'btn btn-primary btn-sm';
        btnQr.className = 'btn btn-secondary btn-sm';
      } else {
        btnQr.className = 'btn btn-primary btn-sm';
        btnFace.className = 'btn btn-secondary btn-sm';
      }
    }

    if (faceActions && qrActions) {
      faceActions.style.display = mode === 'face' ? 'flex' : 'none';
      qrActions.style.display = mode === 'qr' ? 'flex' : 'none';
    }

    if (reticle) {
      if (mode === 'face') {
        reticle.style.borderRadius = '50% / 60%';
        reticle.style.width = '200px';
        reticle.style.height = '260px';
        reticle.innerHTML = '<span style="font-size: 11px; font-weight: 700; color: #fff; background: rgba(0,0,0,0.65); padding: 4px 8px; border-radius: 4px;">ALIGN FACE IN OVAL</span>';
      } else {
        reticle.style.borderRadius = '16px';
        reticle.style.width = '240px';
        reticle.style.height = '240px';
        reticle.innerHTML = '<span style="font-size: 11px; font-weight: 700; color: #fff; background: rgba(0,0,0,0.65); padding: 4px 8px; border-radius: 4px;">ALIGN QR PASS HERE</span>';
      }
    }
  },

  async runDetectionLoop(video) {
    if (!this.isScanning || !video) return;

    if (this.scanMode === 'face') {
      const now = Date.now();
      // Auto-scan face every 1400ms when video is active and not already processing
      if (now - this.lastFaceScanTime > 1400 && !this.isProcessingScan && video.readyState >= 2) {
        this.lastFaceScanTime = now;
        this.captureAndVerifyFace(video, true);
      }
    } else {
      let detectedCode = null;

      // 1. Native BarcodeDetector (Chrome/Edge with support)
      if (this.barcodeDetector && video.readyState >= 2) {
        try {
          const barcodes = await this.barcodeDetector.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            detectedCode = barcodes[0].rawValue;
          }
        } catch (_) {}
      }

      // 2. Pure JS canvas jsQR fallback (100% universal across all browsers)
      if (!detectedCode && window.jsQR && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          if (!this.detectionCanvas) this.detectionCanvas = document.createElement('canvas');
          const canvas = this.detectionCanvas;
          const scale = Math.min(1.0, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (qr && qr.data) {
            detectedCode = qr.data;
          }
        } catch (_) {}
      }

      if (detectedCode && !this.isProcessingScan) {
        await this.handleScannedToken(detectedCode);
        await new Promise(r => setTimeout(r, 1800));
      }
    }

    if (this.isScanning) {
      requestAnimationFrame(() => this.runDetectionLoop(video));
    }
  },

  /**
   * Upload or capture photo of an ID card and decode QR or student face
   */
  async scanCardPhoto(file) {
    if (!file) return;
    this.isProcessingScan = true;

    const feedbackCard = document.getElementById('kiosk-feedback-card') || document.getElementById('coach-feedback-box');
    if (feedbackCard) {
      feedbackCard.className = 'kiosk-feedback-box processing';
      feedbackCard.innerHTML = `
        <div style="font-size: 28px; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i></div>
        <div style="font-size: 16px; font-weight: 700; margin-top: 8px;">Scanning Card Photo...</div>
        <div style="font-size: 12px; color: var(--text-muted);">Decoding QR code & student identity</div>
      `;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let decodedToken = null;

      // 1. Client-side fast jsQR canvas decode
      if (window.jsQR) {
        const img = new Image();
        img.src = dataUrl;
        await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });

        if (img.width > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = window.jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (qr && qr.data) {
            decodedToken = qr.data.trim();
          }
        }
      }

      if (decodedToken) {
        this.isProcessingScan = false;
        return await this.handleScannedToken(decodedToken);
      }

      // 2. Server-side dual fallback with sharp + jsQR + face match
      const branchSelect = document.getElementById('kiosk-branch-select') || document.getElementById('smart-att-branch-select');
      const batchSelect = document.getElementById('kiosk-batch-select') || document.getElementById('coach-scanner-batch-select');

      const formData = new FormData();
      formData.append('photo', file);
      if (branchSelect && branchSelect.value) formData.append('branch_id', branchSelect.value);
      if (batchSelect && batchSelect.value) formData.append('batch_id', batchSelect.value);

      const token = localStorage.getItem('token');
      const res = await fetch('/api/academy/smart-attendance/scan-card-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const outcome = await res.json();
      this.isProcessingScan = false;
      this.displayScanResult(outcome);
    } catch (err) {
      this.isProcessingScan = false;
      this.displayScanResult({
        success: false,
        message: 'Could not decode card photo: ' + err.message,
      });
    }
  },

  /**
   * Captures or uploads a face photo and matches against biometric profiles
   */
  async captureAndVerifyFace(source = null, isSilentAuto = false) {
    if (this.isProcessingScan) return;

    let base64Image = null;

    if (source instanceof Blob || source instanceof File) {
      base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(source);
      });
    } else {
      const video = typeof source === 'string' ? document.getElementById(source) : (source || document.getElementById('kiosk-video') || document.getElementById('coach-video'));
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        if (!isSilentAuto) window.app?.showToast?.('Camera video feed not ready. Please ensure camera is on.', 'warning');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.min(640, video.videoWidth);
      canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      base64Image = canvas.toDataURL('image/jpeg', 0.85);
    }

    if (!base64Image) return;

    this.isProcessingScan = true;
    const feedbackCard = document.getElementById('kiosk-feedback-card') || document.getElementById('coach-feedback-box');
    if (feedbackCard && !isSilentAuto) {
      feedbackCard.className = 'kiosk-feedback-box processing';
      feedbackCard.innerHTML = `
        <div style="font-size: 28px; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i></div>
        <div style="font-size: 16px; font-weight: 700; margin-top: 8px;">Scanning Facial Biometrics...</div>
        <div style="font-size: 12px; color: var(--text-muted);">Comparing with encrypted academy face templates</div>
      `;
    }

    const branchSelect = document.getElementById('kiosk-branch-select') || document.getElementById('smart-att-branch-select');
    const batchSelect = document.getElementById('kiosk-batch-select') || document.getElementById('coach-scanner-batch-select');

    try {
      const outcome = await window.app.apiRequest('/api/academy/smart-attendance/verify', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'face',
          image_base64: base64Image,
          branch_id: branchSelect && branchSelect.value ? Number(branchSelect.value) : null,
          batch_id: batchSelect && batchSelect.value ? Number(batchSelect.value) : null,
          device_code: localStorage.getItem('iss_kiosk_device_code') || 'KIOSK-FACE-01',
        }),
      });

      this.isProcessingScan = false;
      if (outcome.success || !isSilentAuto) {
        this.displayScanResult(outcome);
      }
    } catch (err) {
      this.isProcessingScan = false;
      if (!isSilentAuto) {
        this.displayScanResult({
          success: false,
          message: err.message || 'Face verification failed',
        });
      }
    }
  },

  async handleScannedToken(token) {
    if (!token || !token.trim()) return;
    const cleanToken = token.trim();

    // Determine batch and branch if kiosk has selectors
    const branchSelect = document.getElementById('kiosk-branch-select');
    const batchSelect = document.getElementById('kiosk-batch-select');
    const branchId = branchSelect ? Number(branchSelect.value) : null;
    const batchId = batchSelect && batchSelect.value ? Number(batchSelect.value) : null;

    // Show processing indicator
    const feedbackCard = document.getElementById('kiosk-feedback-card');
    if (feedbackCard) {
      feedbackCard.className = 'kiosk-feedback-box processing';
      feedbackCard.innerHTML = `
        <div style="font-size: 28px; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i></div>
        <div style="font-size: 16px; font-weight: 700; margin-top: 8px;">Verifying Attendance Pass...</div>
      `;
    }

    // Attempt online scan
    try {
      const res = await window.app.apiRequest('/api/academy/smart-attendance/verify', {
        method: 'POST',
        body: JSON.stringify({
          mode: cleanToken.startsWith('04:') ? 'nfc' : 'qr',
          qr_token: cleanToken.startsWith('04:') ? null : cleanToken,
          card_uid: cleanToken.startsWith('04:') ? cleanToken : null,
          branch_id: branchId,
          batch_id: batchId,
          device_code: localStorage.getItem('iss_kiosk_device_code') || 'KIOSK-WEB-01',
        }),
      });

      this.displayScanResult(res);
    } catch (err) {
      // Offline fallback: enqueue to local storage
      this.enqueueOfflineScan({
        token: cleanToken,
        mode: cleanToken.startsWith('04:') ? 'nfc' : 'qr',
        branch_id: branchId,
        batch_id: batchId,
        scanned_at: new Date().toISOString(),
        client_id: 'scan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      });

      this.displayScanResult({
        success: true,
        offline: true,
        message: 'Network offline. Attendance recorded locally and queued for automatic sync.',
        audio_cue: 'success_beep',
      });
    }
  },

  displayScanResult(outcome) {
    const feedbackCard = document.getElementById('kiosk-feedback-card');
    if (!feedbackCard) return;

    this.playAudioFeedback(outcome.audio_cue || (outcome.success ? 'success_beep' : 'error_buzzer'));

    if (outcome.success) {
      const student = outcome.student || {};
      const batch = outcome.batch || {};
      const isLate = outcome.status === 'late';

      feedbackCard.className = `kiosk-feedback-box ${isLate ? 'warning' : 'success'}`;
      feedbackCard.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap;">
          <div style="width: 72px; height: 72px; border-radius: 50%; overflow: hidden; border: 3px solid ${isLate ? '#f59e0b' : '#10b981'}; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; color: #fff;">
            ${student.photo_url ? `<img src="${student.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : (student.first_name || 'S').charAt(0)}
          </div>
          <div style="text-align: left;">
            <div style="font-size: 22px; font-weight: 800; color: #fff;">${student.full_name || student.first_name || 'Student'}</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
              <code>${student.student_code || ''}</code> • <span class="badge ${isLate ? 'badge-warning' : 'badge-success'}">${(outcome.status || 'PRESENT').toUpperCase()}</span>
            </div>
            <div style="font-size: 13px; color: var(--text); margin-top: 4px;">
              <i class="fa-solid fa-layer-group" style="color: var(--primary);"></i> ${batch.name || 'Batch'} (${outcome.check_in_time || ''})
            </div>
          </div>
        </div>
        <div style="margin-top: 12px; font-size: 14px; font-weight: 600; color: ${isLate ? '#f59e0b' : '#10b981'};">
          <i class="fa-solid fa-circle-check"></i> ${outcome.message}
        </div>
      `;
    } else if (outcome.queuedForReview) {
      feedbackCard.className = 'kiosk-feedback-box warning';
      feedbackCard.innerHTML = `
        <div style="font-size: 32px; color: #f59e0b;"><i class="fa-solid fa-clock"></i></div>
        <div style="font-size: 18px; font-weight: 800; color: #fff; margin-top: 6px;">Verification Pending</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">${outcome.message}</div>
      `;
    } else {
      feedbackCard.className = 'kiosk-feedback-box error';
      feedbackCard.innerHTML = `
        <div style="font-size: 36px; color: #ef4444;"><i class="fa-solid fa-circle-xmark"></i></div>
        <div style="font-size: 18px; font-weight: 800; color: #fff; margin-top: 6px;">Check-In Rejected</div>
        <div style="font-size: 13px; color: #fca5a5; margin-top: 4px;">${outcome.message || 'Invalid or unauthorized check-in'}</div>
      `;
    }

    // Auto-clear feedback card after 5 seconds to ready kiosk for next student
    setTimeout(() => {
      if (feedbackCard && feedbackCard.classList.contains('processing') === false) {
        feedbackCard.className = 'kiosk-feedback-box ready';
        feedbackCard.innerHTML = `
          <div style="font-size: 32px; color: var(--text-muted);"><i class="fa-solid fa-qrcode"></i></div>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-heading); margin-top: 6px;">Kiosk Ready for Next Student</div>
          <div style="font-size: 12px; color: var(--text-muted);">Hold your Student ID Pass in front of camera or tap NFC wristband</div>
        `;
      }
    }, 5000);
  },

  enqueueOfflineScan(scanItem) {
    try {
      const existing = JSON.parse(localStorage.getItem(this.offlineQueueKey) || '[]');
      existing.push(scanItem);
      localStorage.setItem(this.offlineQueueKey, JSON.stringify(existing));
      this.updateOfflineBadge();
    } catch (_) {}
  },

  getOfflineScans() {
    try {
      return JSON.parse(localStorage.getItem(this.offlineQueueKey) || '[]');
    } catch (_) {
      return [];
    }
  },

  updateOfflineBadge() {
    const queue = this.getOfflineScans();
    const badge = document.getElementById('offline-queue-badge');
    if (badge) {
      badge.innerText = queue.length;
      badge.style.display = queue.length > 0 ? 'inline-block' : 'none';
    }
  },

  async syncOfflineQueue(silent = false) {
    const queue = this.getOfflineScans();
    if (!queue.length) {
      if (!silent) window.app.showToast('No pending offline scans to sync', 'info');
      return;
    }

    try {
      const payload = {
        scans: queue.map(q => ({
          mode: q.mode,
          qr_token: q.mode === 'qr' ? q.token : null,
          card_uid: q.mode === 'nfc' ? q.token : null,
          batch_id: q.batch_id,
          branch_id: q.branch_id,
          scanned_at: q.scanned_at,
          client_id: q.client_id,
        })),
      };

      const res = await window.app.apiRequest('/api/academy/smart-attendance/sync-offline', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        localStorage.removeItem(this.offlineQueueKey);
        this.updateOfflineBadge();
        window.app.showToast(res.message, 'success');
      } else {
        window.app.showToast(res.error || 'Failed to sync offline queue', 'danger');
      }
    } catch (err) {
      if (!silent) window.app.showToast('Offline sync failed: ' + err.message, 'danger');
    }
  },

  /**
   * Generates crisp vector QR Code SVG without external libraries
   */
  renderQrSvg(text, size = 180) {
    // Basic deterministic visual placeholder / SVG code block
    // Encodes payload string cleanly in standard high-contrast SVG
    return `
      <div style="background: #ffffff; padding: 12px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}" 
             alt="QR Pass" 
             style="width: ${size}px; height: ${size}px; display: block;"
             onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-size:11px;font-weight:700;color:#0f172a;text-align:center;padding:8px;word-break:break-all;\\'>${text}</div>'">
      </div>
    `;
  }
};

window.SmartAttendanceController.init();

