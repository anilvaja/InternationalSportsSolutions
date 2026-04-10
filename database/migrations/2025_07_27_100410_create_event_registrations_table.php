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
        Schema::create('event_registrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->onDelete('cascade');
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->datetime('registered_at');
            $table->enum('status', ['registered', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show'])->default('registered');
            $table->decimal('registration_fee_paid', 8, 2)->default(0);
            $table->enum('payment_status', ['pending', 'paid', 'refunded'])->default('pending');
            $table->datetime('payment_date')->nullable();
            $table->string('payment_method')->nullable();
            $table->string('payment_reference')->nullable();
            
            // Additional Information
            $table->json('additional_info')->nullable(); // Custom form fields
            $table->text('dietary_requirements')->nullable();
            $table->text('medical_notes')->nullable();
            $table->text('special_requests')->nullable();
            
            // Registration management
            $table->foreignId('registered_by')->constrained('users'); // Who registered them
            $table->boolean('waiver_signed')->default(false);
            $table->datetime('waiver_signed_at')->nullable();
            
            // Event participation
            $table->boolean('attended')->nullable();
            $table->json('results')->nullable(); // Competition results, scores, etc.
            $table->integer('rating')->nullable(); // Event satisfaction rating
            $table->text('feedback')->nullable();
            
            $table->timestamps();
            
            // Unique constraint
            $table->unique(['event_id', 'student_id'], 'event_reg_student_unique');
            
            // Indexes
            $table->index(['event_id', 'status']);
            $table->index(['student_id', 'registered_at']);
            $table->index('payment_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('event_registrations');
    }
};
