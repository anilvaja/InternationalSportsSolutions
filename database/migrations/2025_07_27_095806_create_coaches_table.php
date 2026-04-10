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
        Schema::create('coaches', function (Blueprint $table) {
            $table->id();
            $table->string('coach_id')->unique(); // Custom coach ID
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->string('phone');
            $table->date('date_of_birth');
            $table->enum('gender', ['male', 'female', 'other']);
            $table->text('address');
            $table->string('city');
            $table->string('state');
            $table->string('postal_code');
            $table->string('country');
            
            // Professional Information
            $table->json('specializations'); // Martial arts, fitness, etc.
            $table->json('certifications')->nullable(); // Certification details
            $table->integer('years_of_experience')->default(0);
            $table->string('belt_level')->nullable();
            $table->text('bio')->nullable();
            
            // Employment Information
            $table->date('hire_date');
            $table->enum('employment_type', ['full_time', 'part_time', 'contract'])->default('full_time');
            $table->decimal('hourly_rate', 8, 2)->nullable();
            $table->decimal('monthly_salary', 10, 2)->nullable();
            $table->enum('status', ['active', 'inactive', 'on_leave'])->default('active');
            
            // Emergency Contact
            $table->string('emergency_contact_name');
            $table->string('emergency_contact_phone');
            $table->string('emergency_contact_relationship');
            
            // Availability & Schedule
            $table->json('availability')->nullable(); // Days and time slots
            $table->integer('max_students_per_batch')->default(15);
            
            // Media & Documents
            $table->string('photo')->nullable();
            $table->json('documents')->nullable(); // Certificates, ID copies, etc.
            
            // Performance Metrics
            $table->decimal('rating', 3, 2)->default(5.00); // Average rating out of 5
            $table->integer('total_students_trained')->default(0);
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index(['status', 'employment_type']);
            $table->index('hire_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('coaches');
    }
};
