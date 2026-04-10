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
        // Batch Attendances Table - Track batch-level events
        Schema::create('batch_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->foreignId('batch_id')->constrained('batches')->onDelete('cascade');
            $table->date('class_date');
            $table->time('class_start_time');
            $table->time('class_end_time');
            
            // Class status
            $table->enum('status', ['scheduled', 'completed', 'cancelled', 'holiday'])->default('scheduled');
            $table->enum('cancel_reason', ['holiday', 'weather', 'facility_issue', 'coach_unavailable', 'emergency', 'other'])->nullable();
            $table->text('notes')->nullable(); // Reason for cancellation or general notes
            
            // Attendance tracking
            $table->boolean('attendance_taken')->default(false); // Mark when attendance is completed
            $table->foreignId('attendance_marked_by')->nullable()->constrained('users'); // Who marked the attendance
            $table->timestamp('attendance_marked_at')->nullable(); // When attendance was marked
            
            // Make-up class information
            $table->boolean('is_makeup_class')->default(false);
            $table->foreignId('original_batch_attendance_id')->nullable()->constrained('batch_attendances');
            
            $table->timestamps();
            
            // Indexes
            $table->index(['academy_id', 'batch_id', 'class_date']);
            $table->index(['batch_id', 'class_date']);
            $table->index(['status', 'class_date']);
            $table->index('attendance_taken');
            
            // Unique constraint - one record per batch per date
            $table->unique(['batch_id', 'class_date'], 'unique_batch_date');
        });

        // Student Attendances Table - Track individual student attendance
        Schema::create('student_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->foreignId('batch_attendance_id')->constrained('batch_attendances')->onDelete('cascade');
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            
            // Attendance status
            $table->enum('status', ['present', 'absent', 'late', 'excused', 'medical_leave'])->default('present');
            $table->time('actual_arrival_time')->nullable();
            $table->time('actual_departure_time')->nullable();
            
            // Performance tracking
            $table->integer('participation_level')->nullable(); // 1-5 scale
            $table->text('progress_notes')->nullable(); // Coach observations
            $table->text('notes')->nullable(); // Individual notes for this student
            
            // Parent notification
            $table->boolean('parent_notified')->default(false);
            $table->timestamp('parent_notification_sent_at')->nullable();
            
            $table->timestamps();
            
            // Indexes
                $table->index(['academy_id', 'batch_attendance_id', 'student_id'], 'stud_att_acad_batch_student_idx');
                $table->index(['batch_attendance_id', 'student_id'], 'stud_att_batch_student_idx');
                $table->index(['student_id', 'status'], 'stud_att_student_status_idx');
            
            // Unique constraint - one record per student per batch attendance
            $table->unique(['batch_attendance_id', 'student_id'], 'unique_batch_student');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_attendances');
        Schema::dropIfExists('batch_attendances');
    }
};
