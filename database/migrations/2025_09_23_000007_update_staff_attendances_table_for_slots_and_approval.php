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
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->string('slot_name')->nullable()->after('user_id');
            $table->integer('scheduled_minutes')->default(0)->after('break_duration_minutes');
            $table->integer('actual_minutes')->default(0)->after('scheduled_minutes');
            $table->integer('extra_minutes')->default(0)->after('actual_minutes');
            $table->integer('approved_extra_minutes')->default(0)->after('extra_minutes');
            $table->integer('payable_minutes')->default(0)->after('approved_extra_minutes');
            $table->string('overtime_status')->default('none')->after('status'); // none, pending_approval, approved, rejected, auto_approved
            $table->text('overtime_reason')->nullable()->after('overtime_status');
            $table->foreignId('approval_authority_user_id')->nullable()->after('overtime_reason')->constrained('users')->onDelete('set null');
            $table->foreignId('approved_by_user_id')->nullable()->after('approval_authority_user_id')->constrained('users')->onDelete('set null');
            $table->timestamp('approved_at')->nullable()->after('approved_by_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropForeign(['approval_authority_user_id']);
            $table->dropForeign(['approved_by_user_id']);
            $table->dropColumn([
                'slot_name',
                'scheduled_minutes',
                'actual_minutes',
                'extra_minutes',
                'approved_extra_minutes',
                'payable_minutes',
                'overtime_status',
                'overtime_reason',
                'approval_authority_user_id',
                'approved_by_user_id',
                'approved_at',
            ]);
        });
    }
};
