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
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('batch_code')->unique();
            $table->text('description')->nullable();
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade');
            // Removed primary_coach_id constraint (will use coach_id from update migration)
            $table->json('assistant_coaches')->nullable(); // Array of coach IDs
            
            // Schedule Information
            $table->json('schedule'); // Days and times: [{"day": "monday", "start_time": "18:00", "end_time": "19:30"}]
            $table->integer('duration_minutes')->default(90);
            $table->date('start_date');
            $table->date('end_date')->nullable(); // Ongoing batches can have null end date
            
            // Capacity & Level
            $table->integer('max_capacity')->default(20);
            $table->integer('current_enrollment')->default(0);
            $table->string('age_group'); // Kids, Teens, Adults, or specific age range
            $table->string('skill_level'); // Beginner, Intermediate, Advanced
            $table->string('belt_level_range')->nullable(); // White to Yellow, etc.
            
            // Pricing
            $table->decimal('monthly_fee', 8, 2);
            $table->decimal('registration_fee', 8, 2)->default(0);
            $table->boolean('drop_in_allowed')->default(false);
            $table->decimal('drop_in_fee', 8, 2)->nullable();
            
            // Categories & Focus
            $table->json('focus_areas')->nullable(); // What this batch focuses on
            $table->json('equipment_required')->nullable(); // Required equipment
            
            // Status & Management
            $table->enum('status', ['active', 'inactive', 'full', 'completed'])->default('active');
            $table->boolean('is_trial_class_available')->default(true);
            $table->text('notes')->nullable();
            
            // Waitlist
            $table->boolean('waitlist_enabled')->default(true);
            $table->integer('waitlist_count')->default(0);
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index(['branch_id', 'status']);
            // Removed problematic index for primary_coach_id (will use coach_id from update migration)
            $table->index(['age_group', 'skill_level']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
