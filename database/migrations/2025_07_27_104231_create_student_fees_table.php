<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('student_fees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->string('receipt_number')->unique(); // Auto-generated receipt number
            
            // Payment Details
            $table->decimal('installment_paid', 10, 2); // Amount paid in this installment
            $table->integer('months_paid')->default(1); // Number of months covered by this installment payment
            $table->date('payment_date'); // Date when payment was made
            $table->date('next_due_date'); // When next payment is due (payment_for_month + months_paid)
            $table->decimal('total_paid', 10, 2); // Running total of all payments by this student
            
            // Payment Method & Processing
            $table->enum('payment_type', ['cash', 'online', 'card', 'gpay', 'phonepe', 'paytm', 'bank_transfer', 'upi', 'cheque'])->default('cash');
            $table->string('payment_reference')->nullable(); // Transaction ID, cheque number, etc.
            $table->foreignId('fees_taken_by')->constrained('users'); // Staff who collected the fee
            
            // Fee Structure
            $table->decimal('monthly_fee_rate', 8, 2); // Monthly fee rate at time of payment
            $table->decimal('discount_amount', 8, 2)->default(0); // Any discount given
            $table->decimal('late_fee', 8, 2)->default(0); // Late payment penalty
            $table->decimal('additional_charges', 8, 2)->default(0); // Equipment, exam fees, etc.
            $table->json('additional_charges_detail')->nullable(); // Breakdown of additional charges
            
            // Payment Status
            $table->enum('status', ['paid', 'pending', 'overdue', 'cancelled', 'refunded'])->default('paid');
            $table->boolean('is_advance_payment')->default(false); // If paying for future months
            $table->integer('advance_months')->default(0); // How many months in advance
            
            // Notes & Documentation
            $table->text('notes')->nullable(); // "3 months paid in one payment", discounts, etc.
            $table->json('payment_breakdown')->nullable(); // Detailed breakdown of what's included
            $table->string('receipt_file')->nullable(); // Scanned receipt or digital receipt path
            
            // Academy Tracking (for multi-tenant)
            $table->string('academy_fee_code')->nullable(); // Academy-specific fee tracking code
            $table->json('academy_metadata')->nullable(); // Additional academy-specific data
            
            // Relationships
            $table->foreignId('batch_id')->nullable()->constrained('batches')->onDelete('set null'); // Which batch fee is for
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade'); // Which branch collected fee
            
            // Accounting
            $table->string('financial_year')->nullable(); // For accounting purposes
            $table->boolean('is_refund')->default(false); // If this is a refund entry
            $table->foreignId('refund_of_payment_id')->nullable()->constrained('student_fees'); // Original payment if refund
            
            $table->timestamps();
            $table->softDeletes(); // For audit trail
            
            // Indexes for performance
            $table->index(['student_id', 'payment_date']);
            $table->index(['status', 'next_due_date']);
            $table->index(['branch_id', 'payment_date']);
            $table->index(['fees_taken_by', 'payment_date']);
            // Removed problematic index for non-existent payment_for_month column
            $table->index('receipt_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_fees');
    }
};
