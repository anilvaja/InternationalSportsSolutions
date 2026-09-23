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
        Schema::create('staff_attendance_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('salary_type')->default('monthly'); // monthly, hourly, minutly, daily, custom
            $table->decimal('salary_amount', 10, 2)->default(0.00);
            $table->date('effective_from')->nullable();
            $table->integer('working_days_per_month')->default(26);
            $table->decimal('expected_daily_hours', 4, 2)->default(5.00);
            $table->integer('expected_daily_minutes')->default(300);
            $table->boolean('overtime_applicable')->default(true);
            $table->decimal('overtime_rate_multiplier', 4, 2)->default(1.50);
            $table->decimal('overtime_hourly_rate', 10, 2)->nullable();
            $table->string('approval_authority_type')->default('academy_admin'); // academy_admin, branch_head, head_coach, specific_user
            $table->foreignId('approval_authority_user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->integer('approval_threshold_minutes')->default(30); // <=30 mins auto, >30 mins requires approval
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('set null');
            $table->string('schedule_source')->default('fixed_employee'); // fixed_employee, branch_schedule, batch_schedule, flexible_on_demand
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['academy_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_attendance_settings');
    }
};
