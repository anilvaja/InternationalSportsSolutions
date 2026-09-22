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
        Schema::create('staff_payrolls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->date('period_start_date');
            $table->date('period_end_date');
            $table->string('salary_type')->default('monthly');
            $table->integer('total_days_worked')->default(0);
            $table->integer('total_worked_minutes')->default(0);
            $table->decimal('base_salary_amount', 10, 2)->default(0.00);
            $table->decimal('overtime_amount', 10, 2)->default(0.00);
            $table->decimal('allowances', 10, 2)->default(0.00);
            $table->decimal('deductions', 10, 2)->default(0.00);
            $table->decimal('net_salary', 10, 2)->default(0.00);
            $table->string('status')->default('draft'); // draft, approved, paid
            $table->timestamp('paid_at')->nullable();
            $table->string('payment_method')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('generated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['academy_id', 'period_start_date', 'period_end_date']);
            $table->index(['academy_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_payrolls');
    }
};
