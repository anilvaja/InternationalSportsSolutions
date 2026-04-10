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
        Schema::table('branches', function (Blueprint $table) {
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->index(['academy_id', 'status']);
        });

        Schema::table('syllabus_categories', function (Blueprint $table) {
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->index(['academy_id', 'status']);
        });

        Schema::table('syllabus_techniques', function (Blueprint $table) {
            $table->foreignId('academy_id')->constrained('academies')->onDelete('cascade');
            $table->index(['academy_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropForeign(['academy_id']);
            $table->dropColumn('academy_id');
        });

        Schema::table('syllabus_categories', function (Blueprint $table) {
            $table->dropForeign(['academy_id']);
            $table->dropColumn('academy_id');
        });

        Schema::table('syllabus_techniques', function (Blueprint $table) {
            $table->dropForeign(['academy_id']);
            $table->dropColumn('academy_id');
        });
    }
};
