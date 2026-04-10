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
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('academy_id')->nullable()->constrained('academies')->onDelete('cascade');
            $table->string('phone')->nullable();
            $table->string('avatar')->nullable();
            $table->boolean('is_super_admin')->default(false);
            $table->enum('status', ['active', 'inactive'])->default('active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['academy_id']);
            $table->dropColumn(['academy_id', 'phone', 'avatar', 'is_super_admin', 'status']);
        });
    }
};
