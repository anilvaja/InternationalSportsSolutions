<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Academy;
use App\Models\User;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Ensure all academies have default roles
        $academies = Academy::all();
        
        foreach ($academies as $academy) {
            echo "Ensuring default roles for academy: {$academy->name}\n";
            $academy->ensureDefaultRoles();
        }

        // Assign appropriate academy roles to existing users
        $users = User::whereNotNull('academy_id')
                    ->whereNotNull('role')
                    ->whereIn('role', ['academy_admin', 'academ_admin', 'academy_staff'])
                    ->get();

        foreach ($users as $user) {
            echo "Processing user: {$user->name} (Role: {$user->role})\n";
            try {
                $user->handleAcademyRoleAssignment();
                echo "  ✓ Role assigned successfully\n";
            } catch (\Exception $e) {
                echo "  ✗ Error: {$e->getMessage()}\n";
            }
        }

        echo "Academy roles and assignments migration completed!\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This migration doesn't need to be reversed as it only ensures data integrity
        // The roles and assignments it creates are legitimate business data
    }
};
