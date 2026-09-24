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
        Schema::create('staff_attendance_corrections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('staff_attendance_id')->nullable()->constrained('staff_attendances')->onDelete('cascade');
            $table->date('request_date');
            $table->string('slot_name')->nullable();
            $table->dateTime('original_check_in')->nullable();
            $table->dateTime('original_check_out')->nullable();
            $table->dateTime('requested_check_in');
            $table->dateTime('requested_check_out');
            $table->integer('break_duration_minutes')->default(0);
            $table->text('reason');
            $table->string('status')->default('pending'); // pending, approved, rejected
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['academy_id', 'user_id', 'status'], 'staff_att_corr_acad_usr_stat_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_attendance_corrections');
    }
};
