<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            // Add new columns if they don't exist
            if (!Schema::hasColumn('events', 'content')) {
                $table->text('content')->nullable()->after('description');
            }
            if (!Schema::hasColumn('events', 'type')) {
                $table->string('type')->default('general')->after('content');
            }
            if (!Schema::hasColumn('events', 'status')) {
                $table->string('status')->default('draft')->after('type');
            }
            if (!Schema::hasColumn('events', 'event_end_date')) {
                $table->datetime('event_end_date')->nullable();
            }
            if (!Schema::hasColumn('events', 'fee')) {
                $table->decimal('fee', 10, 2)->nullable();
            }
            if (!Schema::hasColumn('events', 'max_participants')) {
                $table->integer('max_participants')->nullable()->after('fee');
            }
            if (!Schema::hasColumn('events', 'eligibility_criteria')) {
                $table->json('eligibility_criteria')->nullable()->after('max_participants');
            }
            if (!Schema::hasColumn('events', 'requires_rsvp')) {
                $table->boolean('requires_rsvp')->default(true)->after('eligibility_criteria');
            }
            if (!Schema::hasColumn('events', 'rsvp_deadline')) {
                $table->datetime('rsvp_deadline')->nullable()->after('requires_rsvp');
            }
            if (!Schema::hasColumn('events', 'email_notifications')) {
                $table->boolean('email_notifications')->default(true)->after('rsvp_deadline');
            }
            if (!Schema::hasColumn('events', 'sms_notifications')) {
                $table->boolean('sms_notifications')->default(false)->after('email_notifications');
            }
            if (!Schema::hasColumn('events', 'dashboard_notifications')) {
                $table->boolean('dashboard_notifications')->default(true)->after('sms_notifications');
            }
            if (!Schema::hasColumn('events', 'image')) {
                $table->string('image')->nullable()->after('dashboard_notifications');
            }
            if (!Schema::hasColumn('events', 'attachments')) {
                $table->json('attachments')->nullable()->after('image');
            }
            if (!Schema::hasColumn('events', 'created_by')) {
                $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null')->after('academy_id');
            }
            if (!Schema::hasColumn('events', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        // Add indexes
        Schema::table('events', function (Blueprint $table) {
            if (Schema::hasColumn('events', 'academy_id')) {
                $table->index(['academy_id', 'status']);
            }
            if (Schema::hasColumn('events', 'event_date')) {
                $table->index(['event_date', 'status']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn([
                'content', 'type', 'status', 'event_end_date', 'fee', 'max_participants',
                'eligibility_criteria', 'requires_rsvp', 'rsvp_deadline',
                'email_notifications', 'sms_notifications', 'dashboard_notifications',
                'image', 'attachments', 'created_by', 'deleted_at'
            ]);
        });
    }
};
