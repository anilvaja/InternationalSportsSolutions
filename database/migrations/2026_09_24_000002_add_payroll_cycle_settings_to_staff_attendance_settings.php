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
            if (!Schema::hasColumn('staff_attendance_settings', 'salary_visibility_day')) {
                $table->integer('salary_visibility_day')->default(5)->after('max_backdate_days');
                $table->integer('salary_cycle_start_day')->default(1)->after('salary_visibility_day');
                $table->integer('salary_cycle_end_day')->default(31)->after('salary_cycle_start_day');
                $table->integer('weekly_working_days')->default(6)->after('salary_cycle_end_day');
                $table->integer('fix_paid_leaves_per_year')->default(12)->after('weekly_working_days');
                $table->integer('flexible_leaves_per_year')->default(4)->after('fix_paid_leaves_per_year');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('staff_attendance_settings', function (Blueprint $table) {
            $table->dropColumn([
                'salary_visibility_day',
                'salary_cycle_start_day',
                'salary_cycle_end_day',
                'weekly_working_days',
                'fix_paid_leaves_per_year',
                'flexible_leaves_per_year',
            ]);
        });
    }
};
