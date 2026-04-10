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
        Schema::create('student_technique_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->foreignId('syllabus_technique_id')->constrained('syllabus_techniques')->onDelete('cascade');
            $table->foreignId('batch_id')->constrained('batches')->onDelete('cascade');
            $table->foreignId('taught_by_coach_id')->nullable()->constrained('coaches')->onDelete('set null');
            $table->enum('status', ['not_started', 'learning', 'practiced', 'mastered'])->default('not_started');
            $table->date('started_date')->nullable();
            $table->date('completed_date')->nullable();
            $table->integer('practice_count')->default(0); // Number of times practiced
            $table->text('coach_notes')->nullable();
            $table->json('assessment_scores')->nullable(); // For storing technique assessment scores
            $table->timestamps();
            
            // Unique constraint - one progress record per student per technique per batch
            $table->unique(['student_id', 'syllabus_technique_id', 'batch_id'], 'stud_tech_prog_unique');
            
            // Indexes
            $table->index(['student_id', 'status']);
            $table->index(['batch_id', 'syllabus_technique_id']);
            $table->index('completed_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_technique_progress');
    }
};
