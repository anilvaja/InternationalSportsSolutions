<?php

namespace App\Filament\Academy\Resources\StaffAttendanceResource\Pages;

use App\Filament\Academy\Resources\StaffAttendanceResource;
use App\Models\StaffAttendance;
use App\Models\User;
use Filament\Actions;
use Filament\Forms;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;

class ListStaffAttendances extends ListRecords
{
    protected static string $resource = StaffAttendanceResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('quick_check_in')
                ->label('Quick Staff Check-In')
                ->icon('heroicon-o-arrow-right-on-rectangle')
                ->color('success')
                ->form([
                    Forms\Components\Select::make('user_id')
                        ->label('Staff Member')
                        ->options(function () {
                            $user = Auth::user();
                            return User::where('academy_id', $user->academy_id)
                                ->where('is_super_admin', false)
                                ->pluck('name', 'id');
                        })
                        ->searchable()
                        ->required(),

                    Forms\Components\DateTimePicker::make('check_in_at')
                        ->label('Check-In Time')
                        ->default(now())
                        ->required(),
                ])
                ->action(function (array $data) {
                    $user = Auth::user();
                    $staff = User::find($data['user_id']);

                    $attendance = StaffAttendance::create([
                        'academy_id' => $user->academy_id,
                        'user_id' => $staff->id,
                        'attendance_date' => now()->toDateString(),
                        'check_in_at' => $data['check_in_at'],
                        'status' => 'present',
                        'salary_type_snapshot' => $staff->salary_type ?: 'monthly',
                        'hourly_rate_snapshot' => $staff->hourly_rate,
                        'minutly_rate_snapshot' => $staff->minutly_rate,
                        'monthly_salary_snapshot' => $staff->monthly_salary,
                        'marked_by' => $user->id,
                    ]);

                    Notification::make()
                        ->title('Staff Checked In')
                        ->body("{$staff->name} checked in successfully.")
                        ->success()
                        ->send();
                }),

            Actions\CreateAction::make()
                ->label('Record Staff Attendance'),
        ];
    }
}
