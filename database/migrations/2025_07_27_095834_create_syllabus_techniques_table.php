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
        Schema::create('syllabus_techniques', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('syllabus_categories')->onDelete('cascade');
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->text('instructions')->nullable(); // Step-by-step instructions
            $table->integer('sort_order')->default(0);
            $table->enum('difficulty_level', ['beginner', 'intermediate', 'advanced'])->default('beginner');
            $table->integer('estimated_learning_time_minutes')->nullable();
            $table->json('key_points')->nullable(); // Important points to remember
            $table->json('common_mistakes')->nullable(); // Common mistakes to avoid
            $table->json('prerequisites')->nullable(); // Required prior techniques
            
            // Media
            $table->string('video_url')->nullable();
            $table->json('images')->nullable(); // Multiple demonstration images
            $table->string('diagram')->nullable(); // Technical diagram
            
            // Evaluation
            $table->json('evaluation_criteria')->nullable(); // How to assess mastery
            $table->boolean('requires_partner')->default(false);
            $table->boolean('requires_equipment')->default(false);
            $table->json('required_equipment')->nullable(); // List of equipment needed
            
            // Teaching aids
            $table->text('teaching_tips')->nullable(); // Tips for instructors
            $table->json('variations')->nullable(); // Different ways to perform
            $table->json('progressions')->nullable(); // How to build up to this technique
            
            $table->enum('status', ['active', 'inactive', 'draft'])->default('active');
            $table->timestamps();
            
            // Indexes
            $table->index(['category_id', 'sort_order']);
            $table->index(['difficulty_level', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('syllabus_techniques');
    }
};
