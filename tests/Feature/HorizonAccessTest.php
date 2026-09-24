<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HorizonAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_horizon(): void
    {
        $response = $this->get('/horizon');
        $response->assertStatus(403);
    }

    public function test_regular_academy_staff_cannot_access_horizon(): void
    {
        $academy = Academy::create([
            'name' => 'Test Academy',
            'slug' => 'test-academy-horizon',
            'contact_email' => 'contact@test-horizon.com',
        ]);
        $user = User::create([
            'name' => 'Regular Staff',
            'email' => 'staff@test-horizon.com',
            'password' => bcrypt('password'),
            'academy_id' => $academy->id,
            'is_super_admin' => false,
        ]);

        $response = $this->actingAs($user)->get('/horizon');
        $response->assertStatus(403);
    }

    public function test_super_admin_can_access_horizon(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@test-horizon.com',
            'password' => bcrypt('password'),
            'is_super_admin' => true,
        ]);

        $response = $this->actingAs($superAdmin)->get('/horizon');
        $response->assertStatus(200);
    }
}
