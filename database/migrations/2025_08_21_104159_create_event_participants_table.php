<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->foreignId('student_id')->constrained()->onDelete('cascade');
            $table->enum('status', ['invited', 'interested', 'not_interested', 'attended', 'no_show'])->default('invited');
            $table->datetime('responded_at')->nullable();
            $table->text('response_notes')->nullable();
            $table->boolean('payment_required')->default(false);
            $table->enum('payment_status', ['pending', 'paid', 'refunded'])->nullable();
            $table->datetime('payment_date')->nullable();
            $table->decimal('amount_paid', 10, 2)->nullable();
            $table->timestamps();
            
            $table->unique(['event_id', 'student_id']);
            $table->index(['event_id', 'status']);
            $table->index(['student_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_participants');
    }
};
