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
            if (!Schema::hasColumn('events', 'registration_approval_required')) {
                $table->boolean('registration_approval_required')->default(false)->after('requires_rsvp');
            }
            if (!Schema::hasColumn('events', 'eligibility_snapshot_version')) {
                $table->integer('eligibility_snapshot_version')->default(1)->after('registration_approval_required');
            }
            if (!Schema::hasColumn('events', 'published_at')) {
                $table->datetime('published_at')->nullable()->after('status');
            }
            if (!Schema::hasColumn('events', 'cancellation_reason')) {
                $table->text('cancellation_reason')->nullable()->after('published_at');
            }
        });

        Schema::table('event_participants', function (Blueprint $table) {
            if (!Schema::hasColumn('event_participants', 'registration_status')) {
                $table->string('registration_status', 30)->default('not_applicable')->after('status');
            }
            if (!Schema::hasColumn('event_participants', 'snapshot_version')) {
                $table->integer('snapshot_version')->default(1)->after('registration_status');
            }
            if (!Schema::hasColumn('event_participants', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null')->after('response_notes');
            }
            if (!Schema::hasColumn('event_participants', 'approved_at')) {
                $table->datetime('approved_at')->nullable()->after('approved_by');
            }
        });

        if (!Schema::hasTable('event_response_history')) {
            Schema::create('event_response_history', function (Blueprint $table) {
                $table->id();
                $table->foreignId('event_id')->constrained('events')->onDelete('cascade');
                $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
                $table->string('previous_status', 30)->nullable();
                $table->string('new_status', 30);
                $table->string('previous_registration_status', 30)->nullable();
                $table->string('new_registration_status', 30)->nullable();
                $table->text('notes')->nullable();
                $table->string('changed_by_type', 30)->default('student');
                $table->unsignedBigInteger('changed_by_id')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['event_id', 'student_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('event_response_history');

        Schema::table('event_participants', function (Blueprint $table) {
            $table->dropColumn(['registration_status', 'snapshot_version', 'approved_by', 'approved_at']);
        });

        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['registration_approval_required', 'eligibility_snapshot_version', 'published_at', 'cancellation_reason']);
        });
    }
};
