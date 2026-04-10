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
            // Add room_location column
            if (!Schema::hasColumn('batches', 'room_location')) {
                $table->string('room_location')->nullable()->after('fees_amount');
            }
            
            // Add age_group column
            if (!Schema::hasColumn('batches', 'age_group')) {
                $table->string('age_group')->nullable()->after('level');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $columns = ['room_location', 'age_group'];
            
            foreach ($columns as $column) {
                if (Schema::hasColumn('batches', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
