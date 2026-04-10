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
        // Academy-specific roles table
        Schema::create('academy_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academy_id')->constrained()->onDelete('cascade');
            $table->string('name'); // admin, manager, coach, staff
            $table->string('display_name');
            $table->text('description')->nullable();
            $table->json('permissions'); // Array of permissions
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->unique(['academy_id', 'name']);
            $table->index(['academy_id', 'is_active']);
        });

        // Academy-specific permissions table
        Schema::create('academy_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // create_students, edit_branches, etc.
            $table->string('display_name');
            $table->string('category'); // students, branches, syllabus, reports, etc.
            $table->text('description')->nullable();
            $table->timestamps();
            
            $table->unique('name');
            $table->index('category');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('academy_permissions');
        Schema::dropIfExists('academy_roles');
    }
};
