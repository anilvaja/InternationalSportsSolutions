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
        Schema::create('academy_permission_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('permissions'); // Array of permission names
            $table->boolean('is_system_template')->default(false); // For default templates
            $table->timestamps();
            
            $table->index(['academy_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('academy_permission_templates');
    }
};
