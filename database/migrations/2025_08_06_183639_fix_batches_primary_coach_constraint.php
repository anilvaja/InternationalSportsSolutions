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
        Schema::table('batches', function (Blueprint $table) {
            // The primary_coach_id column and constraint have been removed from the original migration
            // Just ensure coach_id exists with proper constraint to users table
            if (!Schema::hasColumn('batches', 'coach_id')) {
                $table->foreignId('coach_id')->nullable()->constrained('users')->onDelete('set null');
            }
            
            // Add an index for better performance
            if (!Schema::hasColumn('batches', 'coach_id')) {
                // Only add index if we just created the column
                $table->index(['coach_id', 'status']);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            // Add back the primary_coach_id column with the original constraint
            // Note: This will fail if coaches table doesn't exist
            if (!Schema::hasColumn('batches', 'primary_coach_id')) {
                $table->foreignId('primary_coach_id')->constrained('coaches')->onDelete('restrict');
            }
        });
    }
};
