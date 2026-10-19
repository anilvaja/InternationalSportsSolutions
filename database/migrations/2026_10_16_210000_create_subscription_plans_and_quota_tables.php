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
        if (!Schema::hasTable('subscription_plans')) {
            Schema::create('subscription_plans', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->decimal('price', 10, 2)->default(0);
                $table->string('billing_interval')->default('monthly'); // monthly, yearly, quarterly
                $table->unsignedInteger('trial_days')->default(14);
                $table->string('status')->default('active'); // active, inactive, draft
                $table->boolean('is_default')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('subscription_plan_limits')) {
            Schema::create('subscription_plan_limits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('plan_id')->constrained('subscription_plans')->cascadeOnDelete();
                $table->string('quota_key'); // users, branches, batches, students, students_per_batch, coaches
                $table->unsignedInteger('limit_value');
                $table->string('counting_policy')->default('active_only');
                $table->timestamps();

                $table->unique(['plan_id', 'quota_key']);
            });
        }

        if (!Schema::hasTable('subscription_plan_features')) {
            Schema::create('subscription_plan_features', function (Blueprint $table) {
                $table->id();
                $table->foreignId('plan_id')->constrained('subscription_plans')->cascadeOnDelete();
                $table->string('feature_key');
                $table->boolean('is_enabled')->default(true);
                $table->timestamps();

                $table->unique(['plan_id', 'feature_key']);
            });
        }

        if (!Schema::hasTable('academy_subscriptions')) {
            Schema::create('academy_subscriptions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('academy_id')->constrained('academies')->cascadeOnDelete();
                $table->foreignId('plan_id')->constrained('subscription_plans')->restrictOnDelete();
                $table->string('status')->default('active'); // trial, active, expired, suspended, cancelled
                $table->timestamp('starts_at')->useCurrent();
                $table->timestamp('ends_at')->nullable();
                $table->boolean('auto_renew')->default(true);
                $table->timestamps();

                $table->index(['academy_id', 'status']);
            });
        }

        if (!Schema::hasTable('academy_limit_overrides')) {
            Schema::create('academy_limit_overrides', function (Blueprint $table) {
                $table->id();
                $table->foreignId('academy_id')->constrained('academies')->cascadeOnDelete();
                $table->string('quota_key');
                $table->unsignedInteger('override_value');
                $table->text('reason');
                $table->timestamp('starts_at')->useCurrent();
                $table->timestamp('ends_at')->nullable();
                $table->foreignId('changed_by_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['academy_id', 'quota_key']);
            });
        }

        if (!Schema::hasTable('academy_feature_overrides')) {
            Schema::create('academy_feature_overrides', function (Blueprint $table) {
                $table->id();
                $table->foreignId('academy_id')->constrained('academies')->cascadeOnDelete();
                $table->string('feature_key');
                $table->boolean('is_enabled');
                $table->text('reason')->nullable();
                $table->timestamp('starts_at')->useCurrent();
                $table->timestamp('ends_at')->nullable();
                $table->foreignId('changed_by_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['academy_id', 'feature_key']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('academy_feature_overrides');
        Schema::dropIfExists('academy_limit_overrides');
        Schema::dropIfExists('academy_subscriptions');
        Schema::dropIfExists('subscription_plan_features');
        Schema::dropIfExists('subscription_plan_limits');
        Schema::dropIfExists('subscription_plans');
    }
};
