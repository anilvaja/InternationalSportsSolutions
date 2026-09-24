<?php

namespace App\Filament\Academy\Widgets;

use App\Support\AcademyPermissionHelper;
use Filament\Widgets\Widget;

class QuickLaunchpadWidget extends Widget
{
    protected static string $view = 'filament.academy.widgets.quick-launchpad-widget';

    protected int | string | array $columnSpan = 'full';

    protected static ?int $sort = -3;

    public function getQuickLinks(): array
    {
        $links = [];

        // 1. Class Attendance (Batch Attendance)
        if (AcademyPermissionHelper::can('view_attendances')) {
            $links[] = [
                'title' => 'Class Attendance',
                'description' => 'Batch attendance & student techniques',
                'icon' => 'heroicon-o-clipboard-document-check',
                'url' => url('/academy/attendances'),
                'create_url' => url('/academy/attendances/create'),
                'create_label' => '+ Mark Now',
                'color' => 'emerald',
                'badge' => 'Daily Class',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_attendances'),
            ];
        }

        // 2. Self Attendance (My Attendance & Pay)
        if (AcademyPermissionHelper::can('view_own_staff_attendances')) {
            $links[] = [
                'title' => 'My Attendance & Pay',
                'description' => 'Clock-in/out & work hours log',
                'icon' => 'heroicon-o-user-check',
                'url' => url('/academy/my-attendances'),
                'create_url' => url('/academy/my-attendances'),
                'create_label' => 'Log Check-In',
                'color' => 'blue',
                'badge' => 'Self Log',
                'featured' => true,
                'can_create' => true,
            ];
        }

        // 3. Students Directory
        if (AcademyPermissionHelper::can('view_students')) {
            $links[] = [
                'title' => 'Students',
                'description' => 'Student list, belts & status',
                'icon' => 'heroicon-o-academic-cap',
                'url' => url('/academy/students'),
                'create_url' => url('/academy/students/create'),
                'create_label' => '+ Add Student',
                'color' => 'indigo',
                'badge' => 'Students',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_students'),
            ];
        }

        // 4. Batches & Schedule
        if (AcademyPermissionHelper::can('view_batches')) {
            $links[] = [
                'title' => 'Batches & Schedule',
                'description' => 'Class timings & coach rosters',
                'icon' => 'heroicon-o-rectangle-stack',
                'url' => url('/academy/batches'),
                'create_url' => url('/academy/batches/create'),
                'create_label' => '+ New Batch',
                'color' => 'amber',
                'badge' => 'Schedule',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_batches'),
            ];
        }

        // 5. Fee Collection
        if (AcademyPermissionHelper::can('view_fees')) {
            $links[] = [
                'title' => 'Fee Collection',
                'description' => 'Collect fees & receipts',
                'icon' => 'heroicon-o-banknotes',
                'url' => url('/academy/fee-collections'),
                'create_url' => url('/academy/fee-collections/create'),
                'create_label' => '+ Collect Fee',
                'color' => 'teal',
                'badge' => 'Finance',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_fees'),
            ];
        }

        // 6. Staff Leaves
        if (AcademyPermissionHelper::can('view_staff_leaves')) {
            $links[] = [
                'title' => 'Staff Leaves',
                'description' => 'Apply leave & request approvals',
                'icon' => 'heroicon-o-calendar-days',
                'url' => url('/academy/staff-leaves'),
                'create_url' => url('/academy/staff-leaves/create'),
                'create_label' => '+ Apply Leave',
                'color' => 'rose',
                'badge' => 'Leaves',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_staff_leaves'),
            ];
        }

        // 7. Staff Attendance Admin
        if (AcademyPermissionHelper::can('view_staff_attendances')) {
            $links[] = [
                'title' => 'Staff Attendance',
                'description' => 'All staff attendance logs',
                'icon' => 'heroicon-o-identification',
                'url' => url('/academy/staff-attendances'),
                'color' => 'sky',
                'featured' => false,
            ];
        }

        // 8. Syllabus & Techniques
        if (AcademyPermissionHelper::can('view_syllabus_techniques') || AcademyPermissionHelper::can('view_syllabus_categories')) {
            $links[] = [
                'title' => 'Syllabus & Techniques',
                'description' => 'Belt categories & techniques',
                'icon' => 'heroicon-o-book-open',
                'url' => url('/academy/syllabus-techniques'),
                'color' => 'purple',
                'featured' => false,
            ];
        }

        // 9. Branches
        if (AcademyPermissionHelper::can('view_branches')) {
            $links[] = [
                'title' => 'Branches',
                'description' => 'Academy locations & details',
                'icon' => 'heroicon-o-building-office',
                'url' => url('/academy/branches'),
                'color' => 'cyan',
                'featured' => false,
            ];
        }

        // 10. Organization Holidays
        if (AcademyPermissionHelper::can('view_organization_holidays')) {
            $links[] = [
                'title' => 'Holidays Calendar',
                'description' => 'Academy annual holiday list',
                'icon' => 'heroicon-o-sun',
                'url' => url('/academy/organization-holidays'),
                'color' => 'orange',
                'featured' => false,
            ];
        }

        // 11. Events & Tournaments
        if (AcademyPermissionHelper::can('view_events')) {
            $links[] = [
                'title' => 'Events & Tournaments',
                'description' => 'Competitions & event fees',
                'icon' => 'heroicon-o-trophy',
                'url' => url('/academy/events'),
                'color' => 'violet',
                'featured' => false,
            ];
        }

        // 12. Permissions Management
        if (AcademyPermissionHelper::can('manage_permissions')) {
            $links[] = [
                'title' => 'Roles & Permissions',
                'description' => 'Staff permissions & security',
                'icon' => 'heroicon-o-key',
                'url' => url('/academy/permissions'),
                'color' => 'slate',
                'featured' => false,
            ];
        }

        // 13. Currency & Timezone Settings
        if (AcademyPermissionHelper::can('manage_currency_settings')) {
            $links[] = [
                'title' => 'Currency & Timezone',
                'description' => 'System currency & timezone',
                'icon' => 'heroicon-o-cog-6-tooth',
                'url' => url('/academy/currency-settings'),
                'color' => 'gray',
                'featured' => false,
            ];
        }

        return $links;
    }
}
