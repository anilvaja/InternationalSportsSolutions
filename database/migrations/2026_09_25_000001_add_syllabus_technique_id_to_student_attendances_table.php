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
        Schema::table('student_attendances', function (Blueprint $table) {
            if (!Schema::hasColumn('student_attendances', 'syllabus_technique_id')) {
                $table->foreignId('syllabus_technique_id')->nullable()->after('status')->constrained('syllabus_techniques')->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('student_attendances', function (Blueprint $table) {
            if (Schema::hasColumn('student_attendances', 'syllabus_technique_id')) {
                $table->dropForeign(['syllabus_technique_id']);
                $table->dropColumn('syllabus_technique_id');
            }
        });
    }
};
