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
    this.downloadPdfReceiptDirect({
      academyName: inv.academy_name || (this.selectedAcademy && this.selectedAcademy.name) || 'International Sports Academy',
      academyCity: inv.academy_city || 'Vadodara',
      academyAddress: inv.academy_address || null,
      academyGst: inv.academy_gst || null,
      academyLogo: inv.academy_logo || null,
      receiptNumber: `REC-${inv.invoice_number ? inv.invoice_number.slice(-4) : Date.now().toString().slice(-4)}`,
      invoiceNumber: inv.invoice_number,
      studentName: `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || 'Student',
      studentCode: inv.student_code || 'N/A',
      admissionNumber: inv.admission_number || null,
      branchName: inv.branch_name || 'Main Dojo',
      studentPhone: inv.phone || null,
      amount: Number(inv.paid_amount || inv.net_amount || 0),
      baseFee: Number(inv.base_fee || inv.amount || inv.net_amount || 0),
      discountPercentage: Number(inv.discount_percentage || 0),
      discountAmount: Number(inv.discount_amount || 0),
      discountReason: inv.discount_reason || null,
      taxAmount: Number(inv.tax_amount || 0),
      netAmount: Number(inv.net_amount || inv.amount || 0),
      balanceAmount: Number(inv.balance_amount || 0),
      periodStart: inv.period_start || new Date().toISOString().split('T')[0],
      periodEnd: inv.period_end || new Date().toISOString().split('T')[0],
      monthsCount: inv.months_count || 1,
      nextInstallmentDate: inv.next_installment_date || null,
      paymentMode: 'Online / UPI',
      date: new Date().toISOString().split('T')[0]
    });
  },

  downloadPdfReceiptDirect(opts) {
    // Support legacy arguments if called with positional parameters
    if (typeof opts === 'string') {
      const [academyName, receiptNumber, invoiceNumber, studentName, amount, date] = arguments;
      opts = { academyName, receiptNumber, invoiceNumber, studentName, amount, date };
    }

    const {
      academyName = 'Sports Solutions Academy',
      academyCity = 'Vadodara',
      academyAddress = null,
      academyGst = null,
      receiptNumber = `REC-${Date.now().toString().slice(-4)}`,
      invoiceNumber = 'INV-001',
      studentName = 'Student',
      studentCode = 'STU-001',
      admissionNumber = null,
      branchName = 'Main Campus',
      studentPhone = null,
      amount = 0,
      baseFee = 0,
      discountPercentage = 0,
      discountAmount = 0,
      discountReason = null,
      taxAmount = 0,
      netAmount = 0,
      balanceAmount = 0,
      periodStart = new Date().toISOString().split('T')[0],
      periodEnd = new Date().toISOString().split('T')[0],
      monthsCount = 1,
      nextInstallmentDate = null,
      paymentMode = 'Online / UPI',
      date = new Date().toISOString().split('T')[0]
    } = opts;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // 1. Top Decorative Brand Bar
    doc.setFillColor(30, 41, 59); // Dark Slate
    doc.rect(0, 0, 210, 4, 'F');

    // 2. Academy Header (Sapphire Gradient Feel)
    doc.setFillColor(37, 99, 235); // #2563eb Primary
    doc.rect(0, 4, 210, 36, 'F');

    // Circular Logo Emblem Badge
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 10, 24, 24, 4, 4, 'F');
    doc.setFillColor(37, 99, 235);
    doc.circle(26, 22, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('ISS', 22.5, 25.5);

    // Academy Name & Metadata
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(academyName.toUpperCase(), 44, 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(224, 231, 255);
    const addressLine = `${academyAddress ? academyAddress + ', ' : ''}${academyCity}, India`;
    doc.text(addressLine, 44, 26);
    const subMeta = `${academyGst ? 'GSTIN: ' + academyGst + '  |  ' : ''}SAC: 999293 (Sports Coaching)  |  Official Receipt`;
    doc.text(subMeta, 44, 32);

    // 3. Receipt Sub-Header Banner
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(0, 40, 210, 14, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 54, 210, 54);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('OFFICIAL FEE PAYMENT RECEIPT & TAX INVOICE', 14, 49);

    // Paid Stamp Pill
    const isPaid = balanceAmount <= 0;
    doc.setFillColor(isPaid ? 209 : 254, isPaid ? 250 : 243, isPaid ? 229 : 199);
    doc.roundedRect(155, 43, 41, 8, 2, 2, 'F');
    doc.setTextColor(isPaid ? 6 : 146, isPaid ? 95 : 64, isPaid ? 70 : 14);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(isPaid ? 'PAID & VERIFIED' : 'PARTIALLY PAID', 158, 48.5);

    // 4. Two-Column Metadata Cards
    // Left Box: Student Details
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 58, 88, 42, 2, 2, 'FD');

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 58, 88, 8, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('STUDENT INFORMATION', 18, 63.5);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(studentName, 18, 72);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.text(`Student Code: ${studentCode}`, 18, 78);
    if (admissionNumber) doc.text(`Admission No: ${admissionNumber}`, 18, 83);
    doc.text(`Branch / Dojo: ${branchName}`, 18, admissionNumber ? 88 : 84);
    if (studentPhone) doc.text(`Phone: ${studentPhone}`, 18, admissionNumber ? 93 : 89);

    // Right Box: Transaction & Coverage Period Details
    doc.roundedRect(108, 58, 88, 42, 2, 2, 'FD');
    doc.setFillColor(241, 245, 249);
    doc.rect(108, 58, 88, 8, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RECEIPT & COVERAGE DETAILS', 112, 63.5);

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Receipt No:', 112, 71);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(receiptNumber, 142, 71);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Invoice Ref:', 112, 76);
    doc.setTextColor(15, 23, 42);
    doc.text(invoiceNumber, 142, 76);

    doc.setTextColor(71, 85, 105);
    doc.text('Payment Date:', 112, 81);
    doc.setTextColor(15, 23, 42);
    doc.text(date, 142, 81);

    doc.setTextColor(71, 85, 105);
    doc.text('Payment Mode:', 112, 86);
    doc.setTextColor(15, 23, 42);
    doc.text(paymentMode, 142, 86);

    // Highlighted Coverage Period
    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.text('Coaching Period:', 112, 91);
    doc.text(`${periodStart} to ${periodEnd}`, 142, 91);

    if (nextInstallmentDate) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.text(`Next Due: ${nextInstallmentDate}`, 112, 96);
    }

    // 5. Itemized Fee Breakdown Table
    const tableBody = [
      [
        '1',
        `Curriculum Coaching & Training Tuition\nCoverage: ${periodStart} to ${periodEnd} (${monthsCount} Month${monthsCount > 1 ? 's' : ''})`,
        `₹${(baseFee || netAmount || amount).toLocaleString()}`,
        discountAmount > 0 
          ? `-₹${discountAmount.toLocaleString()} (${discountPercentage}%${discountReason ? ' - ' + discountReason : ''})` 
          : 'None',
        taxAmount > 0 ? `₹${taxAmount.toLocaleString()}` : 'Exempt / Incl.',
        `₹${(netAmount || amount).toLocaleString()}`
      ]
    ];

    doc.autoTable({
      startY: 104,
      head: [['#', 'Fee Item & Coverage Period', 'Base Fee', 'Concession / Discount', 'GST (18%)', 'Net Payable']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 3
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 26, halign: 'right' },
        3: { cellWidth: 38, halign: 'right', textColor: discountAmount > 0 ? [185, 28, 28] : [100, 116, 139] },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 4;

    // 6. Summary Totals Box (Right Aligned)
    const totalsX = 118;
    const totalsWidth = 78;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(totalsX, finalY, totalsWidth, 38, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Base Tuition Fee:', totalsX + 4, finalY + 7);
    doc.setTextColor(30, 41, 59);
    doc.text(`₹${(baseFee || netAmount || amount).toLocaleString()}`, totalsX + totalsWidth - 4, finalY + 7, { align: 'right' });

    if (discountAmount > 0) {
      doc.setTextColor(220, 38, 38);
      doc.text(`Discount (${discountPercentage}%):`, totalsX + 4, finalY + 13);
      doc.text(`-₹${discountAmount.toLocaleString()}`, totalsX + totalsWidth - 4, finalY + 13, { align: 'right' });
    }

    doc.setTextColor(100, 116, 139);
    doc.text('Total Net Fee:', totalsX + 4, finalY + (discountAmount > 0 ? 19 : 14));
    doc.setTextColor(30, 41, 59);
    doc.text(`₹${(netAmount || amount).toLocaleString()}`, totalsX + totalsWidth - 4, finalY + (discountAmount > 0 ? 19 : 14), { align: 'right' });

    // Amount Paid Highlight Row
    doc.setFillColor(240, 253, 244); // Green 50
    doc.rect(totalsX, finalY + 24, totalsWidth, 7, 'F');
    doc.setTextColor(21, 128, 61); // Green 700
    doc.setFont('helvetica', 'bold');
    doc.text('Amount Paid (This Receipt):', totalsX + 4, finalY + 29);
    doc.text(`₹${Number(amount).toLocaleString()}`, totalsX + totalsWidth - 4, finalY + 29, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('Remaining Balance:', totalsX + 4, finalY + 35);
    doc.setTextColor(balanceAmount > 0 ? 185 : 21, balanceAmount > 0 ? 28 : 128, balanceAmount > 0 ? 28 : 61);
    doc.setFont('helvetica', 'bold');
    doc.text(balanceAmount > 0 ? `₹${balanceAmount.toLocaleString()}` : '₹0.00 (Fully Paid)', totalsX + totalsWidth - 4, finalY + 35, { align: 'right' });

    // 7. Security Stamp & Authorized Seal (Bottom Left)
    const sealY = finalY;
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, sealY, 94, 38, 2, 2);

    doc.setFillColor(241, 245, 249);
    doc.circle(28, sealY + 15, 9, 'F');
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('✓', 26, sealY + 18.5);

    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('SYSTEM VERIFIED & DIGITALLY STAMPED', 41, sealY + 12);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Issued by: ${academyName}`, 41, sealY + 17);
    doc.text('Status: Reconciled in Tenant Ledger', 41, sealY + 21);
    doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, 41, sealY + 25);
    doc.text('No signature required • Official computer-generated receipt', 18, sealY + 33);

    // 8. Footer Legal Note
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Thank you for your prompt payment! Keep this official receipt for grading verification and tax records.', 14, 282);
    doc.text(`Powered by International Sports Solutions SaaS  •  ${academyName}`, 14, 286);

    // Save PDF
    const safeStudentName = studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${receiptNumber}-${safeStudentName}.pdf`);
  }
};

document.addEventListener('DOMContentLoaded', () => payApp.init());
