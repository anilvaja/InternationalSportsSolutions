import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Conditional Printing of Discount and GST on Receipts & Print-Identical PDF Design', async (t) => {
  const appJsPath = path.resolve('public/js/app.js');
  const payJsPath = path.resolve('public/js/pay.js');

  const appJs = fs.readFileSync(appJsPath, 'utf8');
  const payJs = fs.readFileSync(payJsPath, 'utf8');

  await t.test('1. app.js: getFeeReceiptHtml conditionally includes discount and GST in table and totals', () => {
    // Check that discount column and totals are guarded by hasDiscount
    assert.match(appJs, /\$\{hasDiscount\s*\?\s*`<th style="text-align: right;">Concession \/ Discount<\/th>`\s*:\s*''\}/);
    assert.match(appJs, /\$\{hasDiscount\s*\?\s*`\s*<div class="totals-row" style="color: #dc2626;/);

    // Check that GST column and totals are guarded by hasGst
    assert.match(appJs, /\$\{hasGst\s*\?\s*`<th style="text-align: right;">GST \(18%\)<\/th>`\s*:\s*''\}/);
    assert.match(appJs, /\$\{hasGst\s*\?\s*`\s*<div class="totals-row" style="color: #2563eb;/);

    // Check that SAC and GSTIN in header & footer are guarded by hasGst
    assert.match(appJs, /\$\{hasGst\s*\?\s*`\s*<div style="font-weight: 600; color: #334155;/);
    assert.match(appJs, /Verified electronically by Academy Fee Collection Desk\$\{hasGst \? ' &bull; SAC 999293' : ''\}/);
  });

  await t.test('2. app.js: generateFeeReceiptPdf uses getFeeReceiptHtml for 100% print-fidelity PDF export', () => {
    // generateFeeReceiptPdf now generates PDF from getFeeReceiptHtml using html2pdf
    assert.match(appJs, /const receiptHtml = this\.getFeeReceiptHtml\(fee/);
    assert.match(appJs, /window\.html2pdf/);
    assert.match(appJs, /from\(elem\)\.save\(\)/);
  });

  await t.test('3. pay.js: downloadPdfReceipt conditionally builds table headers and totals box', () => {
    // Check dynamic headers in pay.js PDF
    assert.match(payJs, /if \(hasDiscount\)\s*\{\s*tableHeaders\.push\('Concession \/ Discount'\);/);
    assert.match(payJs, /if \(hasGst\)\s*\{\s*tableHeaders\.push\('GST \(18%\)'\);/);

    // Check tax invoice title condition in pay.js
    assert.match(payJs, /doc\.text\(hasGst \? 'OFFICIAL FEE PAYMENT RECEIPT & TAX INVOICE' : 'OFFICIAL FEE PAYMENT RECEIPT', 14, 49\);/);

    // Check totals box in pay.js
    assert.match(payJs, /if \(hasDiscount\)\s*\{\s*curY \+= 6;\s*doc\.setTextColor\(220, 38, 38\);/);
    assert.match(payJs, /if \(hasGst\)\s*\{\s*curY \+= 6;\s*doc\.setTextColor\(37, 99, 235\);/);
  });
});
