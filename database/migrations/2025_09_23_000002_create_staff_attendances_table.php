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
        Schema::create('staff_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->date('attendance_date');
            $table->dateTime('check_in_at');
            $table->dateTime('check_out_at')->nullable();
            $table->integer('break_duration_minutes')->default(0);
            $table->integer('total_worked_minutes')->default(0);
            $table->string('status')->default('present'); // present, absent, half_day, on_leave, late, overtime
            $table->string('salary_type_snapshot')->default('monthly'); // hourly, minutly, monthly
            $table->decimal('hourly_rate_snapshot', 10, 2)->nullable();
            $table->decimal('minutly_rate_snapshot', 10, 4)->nullable();
            $table->decimal('monthly_salary_snapshot', 10, 2)->nullable();
            $table->decimal('calculated_pay', 10, 2)->default(0.00);
            $table->text('notes')->nullable();
            $table->foreignId('marked_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['academy_id', 'attendance_date']);
            $table->index(['academy_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_attendances');
    }
};
