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
        Schema::dropIfExists('event_fees');
        
        Schema::create('event_fees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->foreignId('student_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 10, 2);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('final_amount', 10, 2);
            $table->enum('payment_status', ['pending', 'paid', 'partial', 'overdue', 'refunded', 'cancelled'])->default('pending');
            $table->string('payment_method')->nullable();
            $table->timestamp('payment_date')->nullable();
            $table->string('payment_reference')->nullable();
            $table->text('payment_notes')->nullable();
            $table->text('discount_reason')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->decimal('late_fee', 10, 2)->default(0);
            $table->decimal('refund_amount', 10, 2)->default(0);
            $table->timestamp('refund_date')->nullable();
            $table->text('refund_reason')->nullable();
            $table->foreignId('processed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();
            
            $table->unique(['event_id', 'student_id']);
            $table->index(['payment_status', 'due_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('event_fees');
    }
};
