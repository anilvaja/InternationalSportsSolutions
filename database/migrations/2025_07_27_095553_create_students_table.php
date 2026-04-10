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
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('student_id')->unique(); // Custom student ID
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->date('date_of_birth');
            $table->enum('gender', ['male', 'female', 'other']);
            $table->text('address');
            $table->string('city');
            $table->string('state');
            $table->string('postal_code');
            $table->string('country');
            
            // Parent/Guardian Information
            $table->string('parent_name');
            $table->string('parent_phone');
            $table->string('parent_email')->nullable();
            $table->string('parent_relationship')->default('parent');
            
            // Emergency Contact
            $table->string('emergency_contact_name');
            $table->string('emergency_contact_phone');
            $table->string('emergency_contact_relationship');
            
            // Medical Information
            $table->text('medical_conditions')->nullable();
            $table->text('allergies')->nullable();
            $table->text('medications')->nullable();
            $table->string('blood_group')->nullable();
            $table->text('dietary_restrictions')->nullable();
            
            // Academy Information
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade');
            $table->date('enrollment_date');
            $table->enum('status', ['active', 'inactive', 'suspended', 'graduated'])->default('active');
            $table->string('belt_level')->nullable();
            $table->text('notes')->nullable();
            
            // Media
            $table->string('photo')->nullable();
            $table->json('documents')->nullable(); // Store document paths
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index(['status', 'branch_id']);
            $table->index('enrollment_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
