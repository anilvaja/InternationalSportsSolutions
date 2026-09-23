<?php

namespace App\Filament\Academy\Widgets;

use App\Models\StaffAttendance;
use App\Models\StaffAttendanceCorrection;
use App\Models\User;
use Filament\Widgets\Widget;
use Filament\Actions\Action;
use Filament\Actions\Concerns\InteractsWithActions;
use Filament\Actions\Contracts\HasActions;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;
use Carbon\Carbon;

class StaffCheckInWidget extends Widget implements HasActions, HasForms
{
    use InteractsWithActions;
    use InteractsWithForms;

    protected static string $view = 'filament.academy.widgets.staff-check-in-widget';

    protected int | string | array $columnSpan = 'full';

    protected static ?int $sort = -1;

    public function getViewData(): array
    {
        $user = Auth::user();

        if (!$user || $user->is_super_admin) {
            return [
                'hasUser' => false,
            ];
        }

        $today = now()->toDateString();
        $todayAttendances = StaffAttendance::where('academy_id', $user->academy_id)
            ->where('user_id', $user->id)
            ->whereDate('attendance_date', $today)
            ->get();

        $activeSession = $todayAttendances->whereNull('check_out_at')->first();
        $completedSessions = $todayAttendances->whereNotNull('check_out_at');

        $workedMinutes = (int) $todayAttendances->sum('payable_minutes');
        $workedFormatted = $this->formatHoursMinutes($workedMinutes);

        $todayPay = (float) $todayAttendances->sum('calculated_pay');

        // Current month totals
        $startOfMonth = now()->startOfMonth()->toDateString();
        $endOfMonth = now()->endOfMonth()->toDateString();

        $monthlyAttendances = StaffAttendance::where('academy_id', $user->academy_id)
            ->where('user_id', $user->id)
            ->whereBetween('attendance_date', [$startOfMonth, $endOfMonth])
            ->get();

        $monthlyWorkedMinutes = (int) $monthlyAttendances->sum('payable_minutes');
        $monthlyWorkedFormatted = $this->formatHoursMinutes($monthlyWorkedMinutes);
        $monthlyPay = (float) $monthlyAttendances->sum('calculated_pay');

        $salaryTypeLabel = match ($user->salary_type) {
            'hourly' => 'Hourly ($' . number_format($user->hourly_rate ?? 0, 2) . '/hr)',
            'minutly' => 'Minutly ($' . number_format($user->minutly_rate ?? 0, 4) . '/min)',
            'monthly' => 'Monthly ($' . number_format($user->monthly_salary ?? 0, 2) . '/mo)',
            default => 'Not Set',
        };

        return [
            'hasUser' => true,
            'user' => $user,
            'activeSession' => $activeSession,
            'isCheckedIn' => !is_null($activeSession),
            'isCheckedOut' => !is_null($todayAttendances->last()?->check_out_at) && is_null($activeSession),
            'sessionCount' => $todayAttendances->count(),
            'checkInTime' => $activeSession?->check_in_at?->format('H:i') ?? ($todayAttendances->last()?->check_in_at?->format('H:i') ?? '--:--'),
            'checkOutTime' => $todayAttendances->last()?->check_out_at?->format('H:i') ?? '--:--',
            'workedMinutes' => $workedMinutes,
            'workedFormatted' => $workedFormatted,
            'todayPay' => number_format($todayPay, 2),
            'salaryTypeLabel' => $salaryTypeLabel,
            'monthlyWorkedFormatted' => $monthlyWorkedFormatted,
            'monthlyPay' => number_format($monthlyPay, 2),
            'daysWorkedThisMonth' => $monthlyAttendances->where('payable_minutes', '>', 0)->pluck('attendance_date')->unique()->count(),
        ];
    }

    public function checkInAction(): Action
    {
        return Action::make('checkIn')
            ->label('Check In Session')
            ->icon('heroicon-o-arrow-right-on-rectangle')
            ->color('success')
            ->action(function () {
                $user = Auth::user();
                $today = now()->toDateString();

                $activeSession = StaffAttendance::where('academy_id', $user->academy_id)
                    ->where('user_id', $user->id)
                    ->whereDate('attendance_date', $today)
                    ->whereNull('check_out_at')
                    ->first();

                if ($activeSession) {
                    Notification::make()
                        ->title('Active Session In Progress')
                        ->body('You must check out from your active session before starting a new one.')
                        ->warning()
                        ->send();
                    return;
                }

                $sessionNumber = StaffAttendance::where('academy_id', $user->academy_id)
                    ->where('user_id', $user->id)
                    ->whereDate('attendance_date', $today)
                    ->count() + 1;

                StaffAttendance::create([
                    'academy_id' => $user->academy_id,
                    'user_id' => $user->id,
                    'slot_name' => "Slot {$sessionNumber}",
                    'attendance_date' => $today,
                    'check_in_at' => now(),
                    'status' => 'present',
                    'salary_type_snapshot' => $user->salary_type ?: 'monthly',
                    'hourly_rate_snapshot' => $user->hourly_rate,
                    'minutly_rate_snapshot' => $user->minutly_rate,
                    'monthly_salary_snapshot' => $user->monthly_salary,
                    'marked_by' => $user->id,
                ]);

                Notification::make()
                    ->title('Checked In Successfully')
                    ->body("Session #{$sessionNumber} recorded: " . now()->format('H:i'))
                    ->success()
                    ->send();
            });
    }

    public function checkOutAction(): Action
    {
        return Action::make('checkOut')
            ->label('Check Out Now')
            ->icon('heroicon-o-arrow-left-on-rectangle')
            ->color('warning')
            ->action(function () {
                $user = Auth::user();
                $today = now()->toDateString();

                $record = StaffAttendance::where('academy_id', $user->academy_id)
                    ->where('user_id', $user->id)
                    ->whereDate('attendance_date', $today)
                    ->whereNull('check_out_at')
                    ->first();

                if (!$record) {
                    Notification::make()
                        ->title('No Active Check-In Found')
                        ->danger()
                        ->send();
                    return;
                }

                $record->check_out_at = now();
                $record->syncWorkedMinutesAndPay();
                $record->save();

                $formatted = $this->formatHoursMinutes($record->payable_minutes);

                Notification::make()
                    ->title('Checked Out Successfully')
                    ->body("Session completed. Payable time: {$formatted}.")
                    ->success()
                    ->send();
            });
    }

    public function logCustomTimeAction(): Action
    {
        return Action::make('logCustomTime')
            ->label('Log / Request Self Attendance')
            ->icon('heroicon-o-pencil-square')
            ->color('info')
            ->form([
                Forms\Components\DatePicker::make('attendance_date')
                    ->label('Attendance Date')
                    ->default(now())
                    ->required(),

                Forms\Components\TextInput::make('slot_name')
                    ->label('Session / Slot Name')
                    ->default('Slot 1')
                    ->required(),

                Forms\Components\DateTimePicker::make('check_in_at')
                    ->label('Check-In Time')
                    ->default(now())
                    ->required(),

                Forms\Components\DateTimePicker::make('check_out_at')
                    ->label('Check-Out Time'),

                Forms\Components\TextInput::make('break_duration_minutes')
                    ->label('Break Duration (Minutes)')
                    ->numeric()
                    ->default(0),

                Forms\Components\Textarea::make('notes')
                    ->label('Notes / Reason')
                    ->rows(2),
            ])
            ->action(function (array $data) {
                $user = Auth::user();
                $dateObj = Carbon::parse($data['attendance_date']);
                $dateStr = $dateObj->toDateString();

                // Check 2-day retroactive rule
                $twoDaysAgo = now()->subDays(2)->startOfDay();
                if ($dateObj->lt($twoDaysAgo)) {
                    // Create correction / approval request for dates > 2 days prior
                    StaffAttendanceCorrection::create([
                        'academy_id' => $user->academy_id,
                        'user_id' => $user->id,
                        'request_date' => $dateStr,
                        'slot_name' => $data['slot_name'] ?? 'Slot 1',
                        'requested_check_in' => $data['check_in_at'],
                        'requested_check_out' => $data['check_out_at'] ?? now(),
                        'break_duration_minutes' => $data['break_duration_minutes'] ?? 0,
                        'reason' => 'Retroactive self-logging older than 2 days: ' . ($data['notes'] ?? 'N/A'),
                        'status' => 'pending',
                    ]);

                    Notification::make()
                        ->title('Correction Request Submitted')
                        ->body('Attendance date is older than 2 days. A request has been sent to Admin for approval.')
                        ->warning()
                        ->send();
                    return;
                }

                $record = StaffAttendance::create([
                    'academy_id' => $user->academy_id,
                    'user_id' => $user->id,
                    'slot_name' => $data['slot_name'] ?? 'Slot 1',
                    'attendance_date' => $dateStr,
                    'check_in_at' => $data['check_in_at'],
                    'check_out_at' => $data['check_out_at'] ?? null,
                    'break_duration_minutes' => $data['break_duration_minutes'] ?? 0,
                    'notes' => $data['notes'] ?? null,
                    'status' => 'present',
                    'salary_type_snapshot' => $user->salary_type ?: 'monthly',
                    'hourly_rate_snapshot' => $user->hourly_rate,
                    'minutly_rate_snapshot' => $user->minutly_rate,
                    'monthly_salary_snapshot' => $user->monthly_salary,
                    'marked_by' => $user->id,
                ]);

                $formatted = $this->formatHoursMinutes($record->payable_minutes);

                Notification::make()
                    ->title('Attendance Session Logged')
                    ->body("Logged {$formatted} payable duration.")
                    ->success()
                    ->send();
            });
    }

    private function formatHoursMinutes(int $totalMinutes): string
    {
        if ($totalMinutes <= 0) {
            return '0h 0m (0 mins)';
        }

        $hours = floor($totalMinutes / 60);
        $mins = $totalMinutes % 60;

        return "{$hours}h {$mins}m ({$totalMinutes} mins)";
    }
}
