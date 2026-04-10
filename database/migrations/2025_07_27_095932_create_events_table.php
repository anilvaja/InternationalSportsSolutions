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
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug');
            $table->text('description');
            $table->enum('type', ['tournament', 'seminar', 'grading', 'social', 'training_camp', 'competition', 'workshop'])->default('tournament');
            
            // Date & Time
            $table->datetime('start_datetime');
            $table->datetime('end_datetime');
            $table->boolean('is_all_day')->default(false);
            $table->string('timezone')->default('UTC');
            
            // Location
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('set null'); // If held at academy
            $table->string('venue_name')->nullable(); // External venue
            $table->text('venue_address')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            
            // Registration & Capacity
            $table->boolean('registration_required')->default(true);
            $table->datetime('registration_opens_at')->nullable();
            $table->datetime('registration_closes_at')->nullable();
            $table->integer('max_participants')->nullable();
            $table->integer('current_registrations')->default(0);
            $table->boolean('waitlist_enabled')->default(true);
            
            // Eligibility
            $table->json('eligible_belt_levels')->nullable(); // Which belts can participate
            $table->json('eligible_age_groups')->nullable(); // Age restrictions
            $table->json('eligible_branches')->nullable(); // Branch restrictions
            
            // Pricing
            $table->decimal('registration_fee', 8, 2)->default(0);
            $table->decimal('late_registration_fee', 8, 2)->nullable();
            $table->datetime('early_bird_deadline')->nullable();
            $table->decimal('early_bird_discount', 8, 2)->default(0);
            
            // Event Management
            $table->foreignId('organizer_id')->constrained('users'); // Event organizer
            $table->json('staff_assigned')->nullable(); // Array of staff/coach IDs
            $table->json('equipment_needed')->nullable();
            $table->text('special_instructions')->nullable();
            
            // Media & Documentation
            $table->string('featured_image')->nullable();
            $table->json('gallery_images')->nullable();
            $table->json('documents')->nullable(); // Flyers, rules, etc.
            $table->string('external_link')->nullable(); // Website or registration link
            
            // Status & Visibility
            $table->enum('status', ['draft', 'published', 'cancelled', 'completed'])->default('draft');
            $table->enum('visibility', ['public', 'members_only', 'invited_only'])->default('members_only');
            $table->boolean('featured')->default(false);
            
            // Results & Follow-up
            $table->json('results')->nullable(); // Competition results
            $table->text('event_report')->nullable(); // Post-event notes
            $table->json('feedback_summary')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index(['start_datetime', 'status']);
            $table->index(['type', 'status']);
            $table->index(['branch_id', 'start_datetime']);
            $table->index('featured');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
