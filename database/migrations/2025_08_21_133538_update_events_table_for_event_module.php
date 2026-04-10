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
        Schema::table('events', function (Blueprint $table) {
            // Add academy_id column if it doesn't exist
            if (!Schema::hasColumn('events', 'academy_id')) {
                $table->foreignId('academy_id')->nullable()->constrained()->onDelete('cascade');
            }
            
            // Rename start_datetime to event_date if start_datetime exists
            if (Schema::hasColumn('events', 'start_datetime') && !Schema::hasColumn('events', 'event_date')) {
                $table->renameColumn('start_datetime', 'event_date');
            }
            
            // Ensure location column exists (rename venue_name if needed)
            if (!Schema::hasColumn('events', 'location') && Schema::hasColumn('events', 'venue_name')) {
                $table->renameColumn('venue_name', 'location');
            }
            
            // Ensure venue column exists (rename venue_address if needed)
            if (!Schema::hasColumn('events', 'venue') && Schema::hasColumn('events', 'venue_address')) {
                $table->renameColumn('venue_address', 'venue');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            // Reverse the changes
            if (Schema::hasColumn('events', 'academy_id')) {
                $table->dropForeign(['academy_id']);
                $table->dropColumn('academy_id');
            }
            
            if (Schema::hasColumn('events', 'event_date')) {
                $table->renameColumn('event_date', 'start_datetime');
            }
            
            if (Schema::hasColumn('events', 'location')) {
                $table->renameColumn('location', 'venue_name');
            }
            
            if (Schema::hasColumn('events', 'venue')) {
                $table->renameColumn('venue', 'venue_address');
            }
        });
    }
};
