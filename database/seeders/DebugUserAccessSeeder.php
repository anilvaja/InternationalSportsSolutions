<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Academy;
use App\Models\AcademyRole;

class DebugUserAccessSeeder extends Seeder
{
    public function run()
    {
        echo "=== DEBUG USER ACCESS ===\n";
        
        // Find admin users
        $adminUsers = User::where('is_super_admin', true)->orWhere('role', 'admin')->get();
        
        echo "Found " . $adminUsers->count() . " admin users:\n";
        
        foreach ($adminUsers as $user) {
            echo "\nUser: {$user->name} ({$user->email})\n";
            echo "  - is_super_admin: " . ($user->is_super_admin ? 'YES' : 'NO') . "\n";
            echo "  - role: {$user->role}\n";
            echo "  - academy_id: " . ($user->academy_id ?? 'NULL') . "\n";
            
            if ($user->academy_id) {
                $academy = Academy::find($user->academy_id);
                echo "  - academy: " . ($academy ? $academy->name : 'NOT FOUND') . "\n";
                echo "  - academy active: " . ($academy && $academy->isActive() ? 'YES' : 'NO') . "\n";
            }
            
            // Check academy roles
            $academyRoles = $user->academyRoles()->get();
            echo "  - academy roles: " . $academyRoles->pluck('name')->join(', ') . "\n";
            
            foreach ($academyRoles as $role) {
                $permissionCount = count($role->permissions ?? []);
                echo "    - Role '{$role->name}': {$permissionCount} permissions\n";
            }
        }
        
        echo "\n=== ACADEMIES ===\n";
        $academies = Academy::all();
        foreach ($academies as $academy) {
            echo "Academy: {$academy->name} (ID: {$academy->id})\n";
            echo "  - Status: " . ($academy->isActive() ? 'ACTIVE' : 'INACTIVE') . "\n";
            echo "  - Users: " . $academy->users()->count() . "\n";
        }
        
        echo "\n=== PERMISSIONS TEST ===\n";
        
        // Test permission for a specific user
        $testUser = User::where('is_super_admin', true)->first();
        if ($testUser) {
            echo "Testing permissions for: {$testUser->name}\n";
            
            // Simulate login
            auth()->login($testUser);
            
            $permissions = ['view_attendance', 'view_events', 'view_students'];
            foreach ($permissions as $permission) {
                $hasPermission = \App\Support\AcademyPermissionHelper::can($permission);
                echo "  - {$permission}: " . ($hasPermission ? 'YES' : 'NO') . "\n";
            }
            
            auth()->logout();
        }
    }
}
