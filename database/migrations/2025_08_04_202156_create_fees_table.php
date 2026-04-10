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
        Schema::create('fees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained()->onDelete('cascade');
            $table->foreignId('branch_id')->constrained()->onDelete('cascade');
            $table->foreignId('student_id')->constrained()->onDelete('cascade');
            $table->foreignId('batch_id')->constrained()->onDelete('cascade');
            
            // Fee Details
            $table->string('receipt_number')->unique();
            $table->decimal('fees_amount', 10, 2);
            $table->integer('months_paid')->default(1);
            $table->date('payment_date');
            $table->date('fees_from_date');
            $table->date('fees_to_date');
            $table->date('next_installment_date')->nullable();
            
            // Payment Information
            $table->enum('payment_mode', ['cash', 'cheque', 'online', 'upi', 'card', 'bank_transfer'])->default('cash');
            $table->string('transaction_reference')->nullable();
            $table->text('payment_note')->nullable();
            $table->text('fees_note')->nullable();
            
            // Status and Tracking
            $table->enum('status', ['paid', 'pending', 'overdue', 'cancelled'])->default('paid');
            $table->boolean('is_discount_applied')->default(false);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->string('discount_reason')->nullable();
            
            // Staff tracking
            $table->foreignId('collected_by')->nullable()->constrained('users')->onDelete('set null');
            
            $table->timestamps();
            
            // Indexes
            $table->index(['academy_id', 'branch_id']);
            $table->index(['student_id', 'batch_id']);
            $table->index('payment_date');
            $table->index('next_installment_date');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fees');
    }
};
