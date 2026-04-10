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
        Schema::table('syllabus_categories', function (Blueprint $table) {
            if (!Schema::hasColumn('syllabus_categories', 'academy_id')) {
                $table->foreignId('academy_id')->nullable()->constrained()->onDelete('cascade');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('syllabus_categories', function (Blueprint $table) {
            $table->dropForeign(['academy_id']);
            $table->dropColumn('academy_id');
        });
    }
};