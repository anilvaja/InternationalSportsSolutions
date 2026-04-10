<?php

namespace App\Http\Controllers;

use App\Models\AcademyPermission;
use App\Models\AcademyRole;
use App\Models\User;
use App\Models\Branch;
use App\Models\Student;
use App\Models\Batch;
use App\Models\Fee;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\Facade\Pdf;

class PrintController extends Controller
{
    public function __construct()
    {
        // Let Filament handle the authentication
    }

    private function checkPermission(string $permission)
    {
        // Check if user is authenticated via Filament
        if (!Auth::check()) {
            abort(403, 'You must be logged in to access this resource.');
        }
        
        $user = Auth::user();
        
        // Ensure user has academy access
        if (!$user->academy_id && !$user->is_super_admin) {
            abort(403, 'You do not have access to academy resources.');
        }
        
        // For now, allow all academy users to print (permissions will be implemented later)
        // if (!$user->is_super_admin && !$user->hasPermission($permission)) {
        //     abort(403, 'You do not have permission to print this resource.');
        // }
    }

    public function permissions(Request $request)
    {
        $this->checkPermission('print_permissions');
        
        $permissions = AcademyPermission::orderBy('category')->orderBy('display_name')->get();
        $groupedPermissions = $permissions->groupBy('category');
        
        $data = [
            'title' => 'Permissions Report',
            'permissions' => $groupedPermissions,
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.permissions', $data);
        return $pdf->stream('permissions-report.pdf');
    }

    public function users(Request $request)
    {
        $this->checkPermission('print_users');
        
        $academyId = Auth::user()->academy_id;
        $users = User::where('academy_id', $academyId)
            ->where('is_super_admin', false)
            ->with(['activeAcademyRoles.academyRole'])
            ->orderBy('name')
            ->get();
        
        $data = [
            'title' => 'Users Report',
            'users' => $users,
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.users', $data);
        return $pdf->stream('users-report.pdf');
    }

    public function roles(Request $request)
    {
        $this->checkPermission('print_roles');
        
        $academyId = Auth::user()->academy_id;
        $roles = AcademyRole::where('academy_id', $academyId)
            ->withCount('users')
            ->orderBy('name')
            ->get();
        
        $data = [
            'title' => 'Roles Report',
            'roles' => $roles,
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.roles', $data);
        return $pdf->stream('roles-report.pdf');
    }

    public function branches(Request $request)
    {
        $this->checkPermission('print_branches');
        
        $academyId = Auth::user()->academy_id;
        $branches = Branch::where('academy_id', $academyId)
            ->withCount('students')
            ->orderBy('name')
            ->get();
        
        $data = [
            'title' => 'Branches Report',
            'branches' => $branches,
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.branches', $data);
        return $pdf->stream('branches-report.pdf');
    }

    public function students(Request $request)
    {
        $this->checkPermission('print_students');
        
        $academyId = Auth::user()->academy_id;
        $students = Student::where('academy_id', $academyId)
            ->with(['branch'])
            ->orderBy('name')
            ->get();
        
        $data = [
            'title' => 'Students Report',
            'students' => $students,
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.students', $data);
        return $pdf->stream('students-report.pdf');
    }

    public function batches(Request $request)
    {
        $this->checkPermission('print_batches');
        
        $academyId = Auth::user()->academy_id;
        $batches = Batch::where('academy_id', $academyId)
            ->with(['branch', 'coach', 'students' => function($query) {
                $query->wherePivot('is_active', true);
            }])
            ->orderBy('name')
            ->get();
        
        $data = [
            'title' => 'Batches Report',
            'batches' => $batches,
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.batches', $data);
        return $pdf->stream('batches-report.pdf');
    }

    public function attendance(Request $request)
    {
        $this->checkPermission('print_attendance');
        
        // This would be implemented based on attendance model
        $data = [
            'title' => 'Attendance Report',
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.attendance', $data);
        return $pdf->stream('attendance-report.pdf');
    }

    public function syllabus(Request $request)
    {
        $this->checkPermission('print_syllabus');
        
        // This would be implemented based on syllabus model
        $data = [
            'title' => 'Syllabus Report',
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.syllabus', $data);
        return $pdf->stream('syllabus-report.pdf');
    }

    public function coaches(Request $request)
    {
        $this->checkPermission('print_coaches');
        
        // This would be implemented based on coach model or user roles
        $data = [
            'title' => 'Coaches Report',
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.coaches', $data);
        return $pdf->stream('coaches-report.pdf');
    }

    public function payments(Request $request)
    {
        $this->checkPermission('print_payments');
        
        // This would be implemented based on payment model
        $data = [
            'title' => 'Payments Report',
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.payments', $data);
        return $pdf->stream('payments-report.pdf');
    }

    public function reports(Request $request)
    {
        $this->checkPermission('print_reports');
        
        // General reports
        $data = [
            'title' => 'General Reports',
            'academy' => Auth::user()->academy,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.reports', $data);
        return $pdf->stream('general-reports.pdf');
    }

    public function fee(Fee $fee)
    {
        $this->checkPermission('print_fees');
        
        // Load all related data for the fee receipt
        $fee->load(['student', 'batch', 'academy', 'branch', 'collectedBy']);
        
        // Calculate total paid fees for this student
        $totalPaidFees = $fee->student->fees()->where('status', 'paid')->sum('fees_amount');
        
        $data = [
            'title' => 'Fee Receipt',
            'fee' => $fee,
            'student' => $fee->student,
            'batch' => $fee->batch,
            'academy' => $fee->academy,
            'branch' => $fee->branch,
            'totalPaidFees' => $totalPaidFees,
            'generatedBy' => Auth::user()->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.fee-receipt', $data);
        return $pdf->stream("fee-receipt-{$fee->receipt_number}.pdf");
    }

    public function eventParticipants(Event $event)
    {
        $this->checkPermission('print_events');
        
        // Ensure the event belongs to the user's academy
        $user = Auth::user();
        if (!$user->is_super_admin && $event->academy_id !== $user->academy_id) {
            abort(403, 'You do not have access to this event.');
        }
        
        // Load participants with related data
        $participants = $event->participants()
            ->with(['student' => function($query) {
                $query->select('id', 'student_id', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'academy_id');
            }])
            ->orderBy('status')
            ->orderBy('responded_at')
            ->get();
        
        // Get payment information if event has fees
        $paymentInfo = [];
        if ($event->fee > 0) {
            $paymentInfo = $event->fees()
                ->with('student')
                ->get()
                ->keyBy('student_id');
        }
        
        // Statistics
        $stats = [
            'total' => $participants->count(),
            'interested' => $participants->where('status', 'interested')->count(),
            'not_interested' => $participants->where('status', 'not_interested')->count(),
            'attended' => $participants->where('status', 'attended')->count(),
            'no_show' => $participants->where('status', 'no_show')->count(),
            'pending' => $participants->where('status', 'invited')->count(),
        ];
        
        $data = [
            'title' => 'Event Participants List',
            'event' => $event,
            'participants' => $participants,
            'paymentInfo' => $paymentInfo,
            'stats' => $stats,
            'academy' => $event->academy,
            'generatedBy' => $user->name,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('prints.event-participants', $data)
            ->setPaper('a4', 'portrait');
        
        return $pdf->stream("event-participants-{$event->slug}.pdf");
    }
}
