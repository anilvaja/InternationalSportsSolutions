/**
 * Quick Pay Portal Logic with Client-Side jsPDF Letterhead Receipt Generation
 */

const payApp = {
  academies: [],
  selectedAcademy: null,

  async init() {
    this.bindEvents();
    await this.loadAcademies();
  },

  bindEvents() {
    document.getElementById('pay-search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.searchInvoices();
    });
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

  async loadAcademies() {
    try {
      const res = await fetch('/api/public/academies');
      const data = await res.json();
      if (data.success) {
        this.academies = data.academies;
        const select = document.getElementById('pay-academy-select');
        select.innerHTML = '<option value="">-- Choose Academy --</option>' + 
          data.academies.map(a => `<option value="${a.id}">${a.name} (${a.city || 'India'})</option>`).join('');
      }
    } catch (e) {
      this.showToast('Failed to load academies list', 'danger');
    }
  },

  async searchInvoices() {
    const academyId = document.getElementById('pay-academy-select').value;
    const studentCode = document.getElementById('pay-student-code').value.trim();
    const invoiceNumber = document.getElementById('pay-invoice-number').value.trim();

    if (!academyId) {
      this.showToast('Please select an academy', 'danger');
      return;
    }
    if (!studentCode && !invoiceNumber) {
      this.showToast('Please enter either Student Code or Invoice Number', 'danger');
      return;
    }

    this.selectedAcademy = this.academies.find(a => a.id === Number(academyId));

    try {
      let url = `/api/public/invoice-lookup?academy_id=${academyId}`;
      if (invoiceNumber) url += `&invoice_number=${encodeURIComponent(invoiceNumber)}`;
      if (studentCode) url += `&student_code=${encodeURIComponent(studentCode)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.success) {
        this.showToast(data.error || 'No invoices found', 'danger');
        document.getElementById('pay-results-container').style.display = 'none';
        return;
      }

      this.renderInvoices(data.invoices);
    } catch (e) {
      this.showToast('Error searching invoices', 'danger');
    }
  },

  renderInvoices(invoices) {
    const container = document.getElementById('pay-results-container');
    container.style.display = 'block';

    let html = `
      <div class="content-card" style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">
          Matching Invoices (${invoices.length})
        </h2>
        <div style="display: flex; flex-direction: column; gap: 16px;">
    `;

    invoices.forEach(inv => {
      const isPaid = inv.balance_amount <= 0;
      const statusClass = inv.status === 'paid' ? 'badge-success' : (inv.status === 'overdue' ? 'badge-danger' : 'badge-warning');

      html += `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 15px; font-weight: 600; color: #fff;">${inv.title}</h3>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                Invoice #${inv.invoice_number} | Student: <strong>${inv.first_name} ${inv.last_name} (${inv.student_code})</strong>
              </p>
            </div>
            <span class="badge ${statusClass}">${inv.status}</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 12px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 12px;">
            <div>
              <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Total Net</div>
              <div style="font-size: 16px; font-weight: 700; color: #fff;">₹${inv.net_amount.toLocaleString()}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Paid</div>
              <div style="font-size: 16px; font-weight: 700; color: #10b981;">₹${inv.paid_amount.toLocaleString()}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Balance Due</div>
              <div style="font-size: 16px; font-weight: 700; color: #f59e0b;">₹${inv.balance_amount.toLocaleString()}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; color: var(--text-muted);">Due Date: ${inv.due_date}</span>
            <div>
              ${!isPaid ? `
                <button class="btn btn-primary btn-sm" onclick="payApp.processPayment(${inv.id}, ${inv.balance_amount}, '${inv.invoice_number}', '${inv.first_name} ${inv.last_name}')">
                  <i class="fa-solid fa-lock"></i> Pay ₹${inv.balance_amount.toLocaleString()} Now
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm" onclick="payApp.downloadPdfReceipt(${JSON.stringify(inv).replace(/"/g, '&quot;')})">
                  <i class="fa-solid fa-file-pdf"></i> Download Receipt
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
  },

  async processPayment(invoiceId, balanceAmount, invoiceNumber, studentName) {
    if (!confirm(`Confirm online payment of ₹${balanceAmount.toLocaleString()} for Invoice ${invoiceNumber}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/public/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academy_id: this.selectedAcademy.id,
          invoice_id: invoiceId,
          amount: balanceAmount,
          payment_mode: 'upi',
          transaction_reference: `UPI/TXN/${Date.now().toString().slice(-8)}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('Payment successful!', 'success');
        
        // Render receipt container
        this.renderReceiptSuccess({
          academyName: this.selectedAcademy.name,
          receiptNumber: data.receiptNumber,
          invoiceNumber,
          studentName,
          amount: data.amount,
          date: data.date,
        });

        // Re-query invoices
        this.searchInvoices();
      } else {
        this.showToast(data.error || 'Payment failed', 'danger');
      }
    } catch (e) {
      this.showToast('Error processing payment', 'danger');
    }
  },

  renderReceiptSuccess(info) {
    const container = document.getElementById('pay-receipt-container');
    container.style.display = 'block';
    container.innerHTML = `
      <div style="padding: 24px; text-align: center;">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(16,185,129,0.15); color: #10b981; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 12px;">
          <i class="fa-solid fa-check"></i>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #fff;">Payment Receipt Generated!</h2>
        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Receipt #${info.receiptNumber} for ${info.studentName}</p>

        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px; margin: 20px 0; text-align: left; font-size: 13px;">
          <p><strong>Academy:</strong> ${info.academyName}</p>
          <p><strong>Invoice Number:</strong> ${info.invoiceNumber}</p>
          <p><strong>Amount Paid:</strong> ₹${info.amount.toLocaleString()}</p>
          <p><strong>Payment Mode:</strong> Instant UPI Online</p>
          <p><strong>Date:</strong> ${info.date}</p>
        </div>

        <button class="btn btn-success" onclick="payApp.downloadPdfReceiptDirect('${info.academyName}', '${info.receiptNumber}', '${info.invoiceNumber}', '${info.studentName}', ${info.amount}, '${info.date}')">
          <i class="fa-solid fa-download"></i> Download Official PDF Letterhead Receipt
        </button>
      </div>
    `;
    container.scrollIntoView({ behavior: 'smooth' });
  },

  downloadPdfReceipt(inv) {
    this.downloadPdfReceiptDirect(
      inv.academy_name || this.selectedAcademy.name,
      `REC-${inv.invoice_number.slice(-4)}`,
      inv.invoice_number,
      `${inv.first_name} ${inv.last_name}`,
      inv.paid_amount,
      new Date().toISOString().split('T')[0]
    );
  },

  downloadPdfReceiptDirect(academyName, receiptNumber, invoiceNumber, studentName, amount, date) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Letterhead Header
    doc.setFillColor(37, 99, 235); // Brand Blue
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(academyName.toUpperCase(), 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL FEE PAYMENT RECEIPT', 14, 28);
    doc.text(`DATE: ${date}`, 155, 28);

    // Body content
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt #: ${receiptNumber}`, 14, 48);
    doc.text(`Invoice #: ${invoiceNumber}`, 140, 48);

    // AutoTable
    doc.autoTable({
      startY: 55,
      head: [['Description', 'Student Name', 'Mode', 'Amount Paid (INR)']],
      body: [
        ['Sports Coaching & Academy Training Fee', studentName, 'Online / UPI', `INR ${amount.toLocaleString()}`]
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 6 },
    });

    const finalY = doc.lastAutoTable.finalY + 20;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment Status: PAID & VERIFIED IN REAL-TIME', 14, finalY);
    doc.text('This is a computer-generated official receipt. No physical signature required.', 14, finalY + 8);

    // Authorized stamp box
    doc.setDrawColor(200, 200, 200);
    doc.rect(130, finalY, 65, 30);
    doc.text('AUTHORIZED ACADEMY SEAL', 135, finalY + 8);
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.text('[ VERIFIED ELECTRONICALLY ]', 133, finalY + 20);

    doc.save(`${receiptNumber}-${studentName.replace(/\s+/g, '_')}.pdf`);
  }
};

document.addEventListener('DOMContentLoaded', () => payApp.init());
