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
        Schema::table('staff_attendance_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('staff_attendance_settings', 'max_backdate_days')) {
                $table->integer('max_backdate_days')->default(2)->after('approval_threshold_minutes');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('staff_attendance_settings', function (Blueprint $table) {
            if (Schema::hasColumn('staff_attendance_settings', 'max_backdate_days')) {
                $table->dropColumn('max_backdate_days');
            }
        });
    }
};
