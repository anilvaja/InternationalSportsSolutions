<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Academy;

class AssignSuperAdminToAcademySeeder extends Seeder
{
    public function run()
    {
        $superAdmin = User::where('email', 'anilvaja.007@gmail.com')->first();
        
        if ($superAdmin) {
            $superAdmin->academy_id = 1; // Assign to Elite Sports Academy
            $superAdmin->save();
            
            echo "Assigned super admin '{$superAdmin->name}' to academy ID 1\n";
        } else {
            echo "Could not find super admin user\n";
        }
    }
}
