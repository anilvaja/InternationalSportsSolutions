<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // For SQLite, we need to recreate the table with nullable schedule column
        // First, let's just update existing records and handle the constraint in the model
        
        // Update existing records to have a proper schedule value
        DB::statement("
            UPDATE batches 
            SET schedule = COALESCE(
                (CASE 
                    WHEN start_time IS NOT NULL AND end_time IS NOT NULL 
                    THEN start_time || ' - ' || end_time || COALESCE(' on ' || days_of_week, '')
                    ELSE 'Schedule TBD'
                END),
                'Schedule TBD'
            )
            WHERE schedule IS NULL OR schedule = '' OR schedule = 'null'
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nothing to rollback for this data update
    }
};
