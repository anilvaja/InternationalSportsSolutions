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
        Schema::table('users', function (Blueprint $table) {
            $table->string('salary_type')->default('monthly')->after('notes'); // 'hourly', 'minutly', 'monthly'
            $table->decimal('hourly_rate', 10, 2)->nullable()->after('salary_type');
            $table->decimal('minutly_rate', 10, 4)->nullable()->after('hourly_rate');
            $table->decimal('monthly_salary', 10, 2)->nullable()->after('minutly_rate');
            $table->decimal('overtime_hourly_rate', 10, 2)->nullable()->after('monthly_salary');
            $table->decimal('standard_daily_hours', 4, 2)->default(8.00)->after('overtime_hourly_rate');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'salary_type',
                'hourly_rate',
                'minutly_rate',
                'monthly_salary',
                'overtime_hourly_rate',
                'standard_daily_hours',
            ]);
        });
    }
};
