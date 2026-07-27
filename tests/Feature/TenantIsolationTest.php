<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_only_access_own_academy_data(): void
    {
        $academyA = Academy::create([
            'name' => 'Academy Alpha',
            'code' => 'ALPHA',
            'slug' => 'academy-alpha',
            'contact_email' => 'alpha@academy.com',
            'contact_phone' => '1234567890',
            'status' => 'active',
        ]);

        $academyB = Academy::create([
            'name' => 'Academy Beta',
            'code' => 'BETA',
            'slug' => 'academy-beta',
            'contact_email' => 'beta@academy.com',
            'contact_phone' => '0987654321',
            'status' => 'active',
        ]);

        $userA = User::create([
            'name' => 'John Alpha',
            'email' => 'john@alpha.com',
            'password' => bcrypt('password'),
            'academy_id' => $academyA->id,
            'is_super_admin' => false,
        ]);

        $this->assertTrue($userA->canAccessAcademy($academyA));
        $this->assertFalse($userA->canAccessAcademy($academyB));
    }

    public function test_super_admin_can_access_any_academy(): void
    {
        $academy = Academy::create([
            'name' => 'Global Academy',
            'code' => 'GLOBAL',
            'slug' => 'global-academy',
            'contact_email' => 'global@academy.com',
            'contact_phone' => '1122334455',
            'status' => 'active',
        ]);

        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@global.com',
            'password' => bcrypt('password'),
            'is_super_admin' => true,
        ]);

        $this->assertTrue($superAdmin->canAccessAcademy($academy));
    }
}

