<?php

namespace App\Filament\Academy\Widgets;

use App\Models\StaffAttendance;
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
        $todayRecord = StaffAttendance::where('academy_id', $user->academy_id)
            ->where('user_id', $user->id)
            ->where('attendance_date', $today)
            ->first();

        $workedMinutes = $todayRecord ? $todayRecord->total_worked_minutes : 0;
        $workedFormatted = $this->formatHoursMinutes($workedMinutes);

        $todayPay = $todayRecord ? $todayRecord->calculated_pay : 0.00;

        // Current month totals
        $startOfMonth = now()->startOfMonth()->toDateString();
        $endOfMonth = now()->endOfMonth()->toDateString();

        $monthlyAttendances = StaffAttendance::where('academy_id', $user->academy_id)
            ->where('user_id', $user->id)
            ->whereBetween('attendance_date', [$startOfMonth, $endOfMonth])
            ->get();

        $monthlyWorkedMinutes = (int) $monthlyAttendances->sum('total_worked_minutes');
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
            'todayRecord' => $todayRecord,
            'isCheckedIn' => $todayRecord && is_null($todayRecord->check_out_at),
            'isCheckedOut' => $todayRecord && !is_null($todayRecord->check_out_at),
            'checkInTime' => $todayRecord?->check_in_at?->format('H:i') ?? '--:--',
            'checkOutTime' => $todayRecord?->check_out_at?->format('H:i') ?? '--:--',
            'workedMinutes' => $workedMinutes,
            'workedFormatted' => $workedFormatted,
            'todayPay' => number_format($todayPay, 2),
            'salaryTypeLabel' => $salaryTypeLabel,
            'monthlyWorkedFormatted' => $monthlyWorkedFormatted,
            'monthlyPay' => number_format($monthlyPay, 2),
            'daysWorkedThisMonth' => $monthlyAttendances->where('total_worked_minutes', '>', 0)->count(),
        ];
    }

    public function checkInAction(): Action
    {
        return Action::make('checkIn')
            ->label('Check In Now')
            ->icon('heroicon-o-arrow-right-on-rectangle')
            ->color('success')
            ->action(function () {
                $user = Auth::user();
                $today = now()->toDateString();

                $existing = StaffAttendance::where('academy_id', $user->academy_id)
                    ->where('user_id', $user->id)
                    ->where('attendance_date', $today)
                    ->first();

                if ($existing && is_null($existing->check_out_at)) {
                    Notification::make()
                        ->title('Already Checked In')
                        ->warning()
                        ->send();
                    return;
                }

                StaffAttendance::create([
                    'academy_id' => $user->academy_id,
                    'user_id' => $user->id,
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
                    ->body('Your check-in time has been recorded: ' . now()->format('H:i'))
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
                    ->where('attendance_date', $today)
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

                $formatted = $this->formatHoursMinutes($record->total_worked_minutes);

                Notification::make()
                    ->title('Checked Out Successfully')
                    ->body("Worked: {$formatted}. Estimated Pay: \${$record->calculated_pay}")
                    ->success()
                    ->send();
            });
    }

    public function logCustomTimeAction(): Action
    {
        return Action::make('logCustomTime')
            ->label('Log / Edit Self Attendance')
            ->icon('heroicon-o-pencil-square')
            ->color('info')
            ->form([
                Forms\Components\DatePicker::make('attendance_date')
                    ->label('Attendance Date')
                    ->default(now())
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
                    ->label('Work Notes / Remarks')
                    ->rows(2),
            ])
            ->action(function (array $data) {
                $user = Auth::user();
                $dateStr = Carbon::parse($data['attendance_date'])->toDateString();

                $record = StaffAttendance::updateOrCreate(
                    [
                        'academy_id' => $user->academy_id,
                        'user_id' => $user->id,
                        'attendance_date' => $dateStr,
                    ],
                    [
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
                    ]
                );

                $formatted = $this->formatHoursMinutes($record->total_worked_minutes);

                Notification::make()
                    ->title('Attendance Saved')
                    ->body("Logged {$formatted} worked. Pay: \${$record->calculated_pay}")
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
