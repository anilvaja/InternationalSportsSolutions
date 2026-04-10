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
        Schema::create('batch_syllabus_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained()->onDelete('cascade');
            $table->foreignId('syllabus_category_id')->constrained()->onDelete('cascade');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_primary')->default(false); // One category can be marked as primary
            $table->text('notes')->nullable(); // Additional notes for this category in this batch
            $table->timestamps();
            
            // Ensure unique combination
            $table->unique(['batch_id', 'syllabus_category_id']);
            
            // Index for better performance
            $table->index(['batch_id', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batch_syllabus_categories');
    }
};
