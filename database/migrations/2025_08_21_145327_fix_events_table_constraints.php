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
        Schema::table('events', function (Blueprint $table) {
            // Make columns that should be nullable actually nullable
            $table->datetime('end_datetime')->nullable()->change();
            $table->string('slug')->nullable()->change();
            $table->text('description')->nullable()->change();
            $table->string('type')->nullable()->change();
            if (Schema::hasColumn('events', 'start_datetime')) {
                $table->datetime('start_datetime')->nullable()->change();
            }
            $table->boolean('is_all_day')->nullable()->default(false)->change();
            $table->string('timezone')->nullable()->change();
            if (Schema::hasColumn('events', 'branch_id')) {
                $table->unsignedBigInteger('branch_id')->nullable()->change();
            }
            if (Schema::hasColumn('events', 'venue_name')) {
                $table->string('venue_name')->nullable()->change();
            }
            if (Schema::hasColumn('events', 'venue_address')) {
                $table->text('venue_address')->nullable()->change();
            }
            if (Schema::hasColumn('events', 'latitude')) {
                $table->decimal('latitude', 10, 8)->nullable()->change();
            }
            if (Schema::hasColumn('events', 'longitude')) {
                $table->decimal('longitude', 11, 8)->nullable()->change();
            }
            $table->boolean('registration_required')->nullable()->default(false)->change();
            $table->datetime('registration_opens_at')->nullable()->change();
            $table->datetime('registration_closes_at')->nullable()->change();
            $table->integer('max_participants')->nullable()->change();
            $table->integer('current_registrations')->nullable()->default(0)->change();
            $table->boolean('waitlist_enabled')->nullable()->default(false)->change();
            $table->json('eligible_belt_levels')->nullable()->change();
            $table->json('eligible_age_groups')->nullable()->change();
            $table->json('eligible_branches')->nullable()->change();
            $table->decimal('registration_fee', 10, 2)->nullable()->default(0)->change();
            $table->decimal('late_registration_fee', 10, 2)->nullable()->change();
            $table->datetime('early_bird_deadline')->nullable()->change();
            $table->decimal('early_bird_discount', 10, 2)->nullable()->change();
            if (Schema::hasColumn('events', 'organizer_id')) {
                $table->unsignedBigInteger('organizer_id')->nullable()->change();
            }
            $table->json('staff_assigned')->nullable()->change();
            $table->json('equipment_needed')->nullable()->change();
            $table->text('special_instructions')->nullable()->change();
            $table->string('featured_image')->nullable()->change();
            $table->json('gallery_images')->nullable()->change();
            $table->json('documents')->nullable()->change();
            $table->string('external_link')->nullable()->change();
            $table->string('status')->nullable()->default('draft')->change();
            $table->string('visibility')->nullable()->default('public')->change();
            $table->boolean('featured')->nullable()->default(false)->change();
            $table->json('results')->nullable()->change();
            $table->text('event_report')->nullable()->change();
            $table->text('feedback_summary')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // We won't reverse these changes as they fix data integrity issues
    }
};
