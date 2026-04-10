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
        Schema::create('batch_student', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('batches')->onDelete('cascade');
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->date('enrollment_date');
            $table->date('last_attendance_date')->nullable();
            $table->enum('status', ['active', 'inactive', 'completed', 'transferred'])->default('active');
            $table->text('notes')->nullable();
            $table->decimal('custom_fee', 8, 2)->nullable(); // If different from batch default
            $table->timestamps();
            
            // Unique constraint
            $table->unique(['batch_id', 'student_id'], 'batch_student_unique');
            
            // Indexes
            $table->index(['student_id', 'status']);
            $table->index('enrollment_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batch_student');
    }
};
