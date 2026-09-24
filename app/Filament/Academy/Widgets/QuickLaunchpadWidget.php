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
                'description' => 'Mark batch attendance & technique levels',
                'icon' => 'heroicon-o-clipboard-document-check',
                'url' => url('/academy/attendances'),
                'create_url' => url('/academy/attendances/create'),
                'create_label' => '+ Take Attendance',
                'badge' => 'Class Roster',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_attendances'),
                'bg_light' => 'bg-emerald-50 dark:bg-emerald-950/40',
                'text_color' => 'text-emerald-600 dark:text-emerald-400',
                'border_color' => 'border-emerald-200 dark:border-emerald-900/60',
                'hover_border' => 'hover:border-emerald-400 dark:hover:border-emerald-600',
                'btn_bg' => 'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-xs',
            ];
        }

        // 2. Self Attendance (My Attendance & Pay)
        if (AcademyPermissionHelper::can('view_own_staff_attendances')) {
            $links[] = [
                'title' => 'Self Attendance',
                'description' => 'Clock-in/out & live work hours',
                'icon' => 'heroicon-o-clock',
                'url' => url('/academy/my-attendances'),
                'create_url' => url('/academy/my-attendances'),
                'create_label' => 'Log Check-In',
                'badge' => 'My Hours',
                'featured' => true,
                'can_create' => true,
                'bg_light' => 'bg-sky-50 dark:bg-sky-950/40',
                'text_color' => 'text-sky-600 dark:text-sky-400',
                'border_color' => 'border-sky-200 dark:border-sky-900/60',
                'hover_border' => 'hover:border-sky-400 dark:hover:border-sky-600',
                'btn_bg' => 'bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-600 shadow-xs',
            ];
        }

        // 3. Students Directory
        if (AcademyPermissionHelper::can('view_students')) {
            $links[] = [
                'title' => 'Students Directory',
                'description' => 'Student list, belt levels & records',
                'icon' => 'heroicon-o-academic-cap',
                'url' => url('/academy/students'),
                'create_url' => url('/academy/students/create'),
                'create_label' => '+ Add Student',
                'badge' => 'Profiles',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_students'),
                'bg_light' => 'bg-indigo-50 dark:bg-indigo-950/40',
                'text_color' => 'text-indigo-600 dark:text-indigo-400',
                'border_color' => 'border-indigo-200 dark:border-indigo-900/60',
                'hover_border' => 'hover:border-indigo-400 dark:hover:border-indigo-600',
                'btn_bg' => 'bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-xs',
            ];
        }

        // 4. Batches & Schedule
        if (AcademyPermissionHelper::can('view_batches')) {
            $links[] = [
                'title' => 'Batches & Schedule',
                'description' => 'Class timings & coach assignments',
                'icon' => 'heroicon-o-rectangle-stack',
                'url' => url('/academy/batches'),
                'create_url' => url('/academy/batches/create'),
                'create_label' => '+ New Batch',
                'badge' => 'Schedules',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_batches'),
                'bg_light' => 'bg-amber-50 dark:bg-amber-950/40',
                'text_color' => 'text-amber-600 dark:text-amber-400',
                'border_color' => 'border-amber-200 dark:border-amber-900/60',
                'hover_border' => 'hover:border-amber-400 dark:hover:border-amber-600',
                'btn_bg' => 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 shadow-xs',
            ];
        }

        // 5. Fee Collection
        if (AcademyPermissionHelper::can('view_fees')) {
            $links[] = [
                'title' => 'Fee Collection',
                'description' => 'Collect student fees & receipts',
                'icon' => 'heroicon-o-banknotes',
                'url' => url('/academy/fee-collections'),
                'create_url' => url('/academy/fee-collections/create'),
                'create_label' => '+ Collect Fee',
                'badge' => 'Payments',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_fees'),
                'bg_light' => 'bg-teal-50 dark:bg-teal-950/40',
                'text_color' => 'text-teal-600 dark:text-teal-400',
                'border_color' => 'border-teal-200 dark:border-teal-900/60',
                'hover_border' => 'hover:border-teal-400 dark:hover:border-teal-600',
                'btn_bg' => 'bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-500 dark:hover:bg-teal-600 shadow-xs',
            ];
        }

        // 6. Staff Leaves
        if (AcademyPermissionHelper::can('view_staff_leaves')) {
            $links[] = [
                'title' => 'Staff Leaves',
                'description' => 'Apply leave & view request status',
                'icon' => 'heroicon-o-calendar-days',
                'url' => url('/academy/staff-leaves'),
                'create_url' => url('/academy/staff-leaves/create'),
                'create_label' => '+ Apply Leave',
                'badge' => 'Leaves',
                'featured' => true,
                'can_create' => AcademyPermissionHelper::can('create_staff_leaves'),
                'bg_light' => 'bg-rose-50 dark:bg-rose-950/40',
                'text_color' => 'text-rose-600 dark:text-rose-400',
                'border_color' => 'border-rose-200 dark:border-rose-900/60',
                'hover_border' => 'hover:border-rose-400 dark:hover:border-rose-600',
                'btn_bg' => 'bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-500 dark:hover:bg-rose-600 shadow-xs',
            ];
        }

        // 7. Staff Attendance Admin
        if (AcademyPermissionHelper::can('view_staff_attendances')) {
            $links[] = [
                'title' => 'Staff Attendance',
                'description' => 'All staff attendance logs',
                'icon' => 'heroicon-o-identification',
                'url' => url('/academy/staff-attendances'),
                'bg_light' => 'bg-blue-50 dark:bg-blue-950/40',
                'text_color' => 'text-blue-600 dark:text-blue-400',
                'featured' => false,
            ];
        }

        // 8. Syllabus & Techniques
        if (AcademyPermissionHelper::can('view_syllabus_techniques') || AcademyPermissionHelper::can('view_syllabus_categories')) {
            $links[] = [
                'title' => 'Syllabus & Belt Techniques',
                'description' => 'Belt categories & techniques',
                'icon' => 'heroicon-o-book-open',
                'url' => url('/academy/syllabus-techniques'),
                'bg_light' => 'bg-purple-50 dark:bg-purple-950/40',
                'text_color' => 'text-purple-600 dark:text-purple-400',
                'featured' => false,
            ];
        }

        // 9. Branches
        if (AcademyPermissionHelper::can('view_branches')) {
            $links[] = [
                'title' => 'Academy Branches',
                'description' => 'Academy locations & details',
                'icon' => 'heroicon-o-building-office',
                'url' => url('/academy/branches'),
                'bg_light' => 'bg-cyan-50 dark:bg-cyan-950/40',
                'text_color' => 'text-cyan-600 dark:text-cyan-400',
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
                'bg_light' => 'bg-orange-50 dark:bg-orange-950/40',
                'text_color' => 'text-orange-600 dark:text-orange-400',
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
                'bg_light' => 'bg-violet-50 dark:bg-violet-950/40',
                'text_color' => 'text-violet-600 dark:text-violet-400',
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
                'bg_light' => 'bg-slate-100 dark:bg-slate-800',
                'text_color' => 'text-slate-700 dark:text-slate-300',
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
                'bg_light' => 'bg-gray-100 dark:bg-gray-800',
                'text_color' => 'text-gray-700 dark:text-gray-300',
                'featured' => false,
            ];
        }

        return $links;
    }
}
