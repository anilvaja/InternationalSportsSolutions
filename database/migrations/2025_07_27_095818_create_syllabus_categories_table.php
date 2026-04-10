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
        Schema::create('syllabus_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('syllabus_categories')->onDelete('cascade');
            $table->integer('sort_order')->default(0);
            $table->string('belt_level')->nullable(); // Associated belt level
            $table->string('age_group')->nullable(); // Kids, teens, adults
            $table->enum('difficulty_level', ['beginner', 'intermediate', 'advanced'])->default('beginner');
            $table->integer('estimated_duration_minutes')->nullable(); // Time to master
            $table->json('prerequisites')->nullable(); // Required prior categories/techniques
            $table->string('icon')->nullable(); // Icon for UI
            $table->string('color')->nullable(); // Color coding
            $table->enum('status', ['active', 'inactive', 'draft'])->default('active');
            $table->timestamps();
            
            // Indexes
            $table->index(['parent_id', 'sort_order']);
            $table->index(['belt_level', 'age_group']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('syllabus_categories');
    }
};
