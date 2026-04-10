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
        // The problematic index has been removed from the original migration
        // No action needed here
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Don't recreate the problematic index as it references a non-existent column
    }
};
