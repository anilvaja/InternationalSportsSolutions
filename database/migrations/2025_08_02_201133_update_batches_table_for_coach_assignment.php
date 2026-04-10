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
            // Add academy_id if it doesn't exist
            if (!Schema::hasColumn('batches', 'academy_id')) {
                $table->foreignId('academy_id')->after('id')->constrained()->onDelete('cascade');
            }
            
            // Add coach_id column (single coach assignment)
            if (!Schema::hasColumn('batches', 'coach_id')) {
                $table->foreignId('coach_id')->after('branch_id')->nullable()->constrained('users')->onDelete('set null');
            }
            
            // Add simplified columns if they don't exist
            if (!Schema::hasColumn('batches', 'level')) {
                $table->string('level')->after('description')->nullable(); // Beginner, Intermediate, Advanced
            }
            
            if (!Schema::hasColumn('batches', 'max_students')) {
                $table->integer('max_students')->after('level')->default(20);
            }
            
            if (!Schema::hasColumn('batches', 'start_time')) {
                $table->time('start_time')->after('max_students')->nullable();
            }
            
            if (!Schema::hasColumn('batches', 'end_time')) {
                $table->time('end_time')->after('start_time')->nullable();
            }
            
            if (!Schema::hasColumn('batches', 'days_of_week')) {
                $table->json('days_of_week')->after('end_time')->nullable(); // ['monday', 'wednesday', 'friday']
            }
            
            if (!Schema::hasColumn('batches', 'fees_amount')) {
                $table->decimal('fees_amount', 10, 2)->after('days_of_week')->nullable();
            }
            
            if (!Schema::hasColumn('batches', 'is_active')) {
                $table->boolean('is_active')->after('fees_amount')->default(true);
            }
            
            if (!Schema::hasColumn('batches', 'notes')) {
                $table->text('notes')->after('is_active')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $columns = [
                'academy_id',
                'coach_id', 
                'level',
                'max_students',
                'start_time',
                'end_time',
                'days_of_week',
                'fees_amount',
                'is_active',
                'notes'
            ];
            
            foreach ($columns as $column) {
                if (Schema::hasColumn('batches', $column)) {
                    if (in_array($column, ['academy_id', 'coach_id'])) {
                        $table->dropForeign([$column]);
                    }
                    $table->dropColumn($column);
                }
            }
        });
    }
};
