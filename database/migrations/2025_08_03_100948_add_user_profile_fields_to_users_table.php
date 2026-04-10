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
            $table->date('date_of_birth')->nullable();
            $table->string('employee_id')->nullable()->unique();
            $table->string('department')->nullable();
            $table->integer('coaching_experience')->nullable();
            $table->json('specialization')->nullable();
            $table->text('certifications')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('bio')->nullable();
            $table->text('notes')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'date_of_birth',
                'employee_id',
                'department',
                'coaching_experience',
                'specialization',
                'certifications',
                'is_active',
                'bio',
                'notes',
            ]);
        });
    }
};
