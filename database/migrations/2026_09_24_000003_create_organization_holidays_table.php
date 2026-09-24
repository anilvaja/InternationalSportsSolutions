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
        Schema::create('organization_holidays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->nullable()->constrained('academies')->onDelete('cascade');
            $table->string('title');
            $table->date('holiday_date');
            $table->string('type')->default('fixed'); // fixed, flexible_religious
            $table->integer('year')->default(2026);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organization_holidays');
    }
};
