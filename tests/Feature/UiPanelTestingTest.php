<?php

namespace Tests\Feature;

use App\Models\Academy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UiPanelTestingTest extends TestCase
{
    use RefreshDatabase;

    public function test_welcome_page_renders_successfully(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('International Sports Solutions');
        $response->assertSee('Admin Panel');
        $response->assertSee('Academy Panel');
        $response->assertSee('Student Panel');
    }

    public function test_admin_panel_login_page_renders(): void
    {
        $response = $this->get('/admin/login');

        $response->assertStatus(200);
    }

    public function test_super_admin_can_access_admin_dashboard(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@test.com',
            'password' => bcrypt('password'),
            'is_super_admin' => true,
            'status' => 'active',
            'is_active' => true,
        ]);

        $response = $this->actingAs($superAdmin)->get('/admin');

        $response->assertStatus(200);
    }

    public function test_academy_panel_login_page_renders(): void
    {
        $response = $this->get('/academy/login');

        $response->assertStatus(200);
    }

    public function test_academy_user_can_access_academy_dashboard(): void
    {
        $academy = Academy::create([
            'name' => 'Test Academy',
            'slug' => 'test-academy',
            'contact_email' => 'contact@testacademy.com',
            'contact_phone' => '1234567890',
            'status' => 'active',
        ]);

        $academyUser = User::create([
            'name' => 'Academy Admin User',
            'email' => 'academyuser@test.com',
            'password' => bcrypt('password'),
            'academy_id' => $academy->id,
            'role' => 'academy_admin',
            'is_super_admin' => false,
            'status' => 'active',
            'is_active' => true,
        ]);

        $response = $this->actingAs($academyUser)->get('/academy');

        $response->assertStatus(200);
    }

    public function test_student_portal_login_page_renders(): void
    {
        $response = $this->get('/student/login');

        $response->assertStatus(200);
    }

    public function test_super_admin_can_access_academy_panel_without_null_crashes(): void
    {
        $academy = Academy::create([
            'name' => 'Super Test Academy',
            'slug' => 'super-test-academy',
            'contact_email' => 'super@test.com',
            'contact_phone' => '1234567890',
            'status' => 'active',
        ]);

        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@test.com',
            'password' => bcrypt('password'),
            'is_super_admin' => true,
            'status' => 'active',
            'is_active' => true,
            'academy_id' => null, // Super admin starts with null academy context
        ]);

        // Access academy dashboard - should automatically assign first academy and succeed
        $response = $this->actingAs($superAdmin)->get('/academy');
        $response->assertStatus(200);

        // Access student list page - should load successfully without null pointer error
        $response2 = $this->actingAs($superAdmin)->get('/academy/students');
        $response2->assertStatus(200);
    }
}
