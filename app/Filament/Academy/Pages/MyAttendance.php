<?php

namespace App\Filament\Academy\Pages;

use App\Models\StaffAttendance;
use App\Models\User;
use Filament\Pages\Page;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;
use Filament\Tables;
use Filament\Actions;
use Filament\Forms;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;
use Carbon\Carbon;

class MyAttendance extends Page implements HasForms, HasTable
{
    use InteractsWithForms;
    use InteractsWithTable;

    protected static ?string $navigationIcon = 'heroicon-o-user-circle';

    protected static string $view = 'filament.academy.pages.my-attendance';

    protected static ?string $navigationLabel = 'My Attendance & Pay';

    protected static ?string $navigationGroup = 'Staff Management';

    protected static ?int $navigationSort = 0;

    public static function canAccess(): bool
    {
        $user = Auth::user();
        return $user && !$user->is_super_admin && !is_null($user->academy_id);
    }

    public function table(Table $table): Table
    {
        $user = Auth::user();

        return $table
            ->query(
                StaffAttendance::query()
                    ->where('academy_id', $user->academy_id)
                    ->where('user_id', $user->id)
            )
            ->columns([
                Tables\Columns\TextColumn::make('attendance_date')
                    ->label('Date')
                    ->date('M d, Y (D)')
                    ->sortable(),

                Tables\Columns\TextColumn::make('check_in_at')
                    ->label('Check In')
                    ->dateTime('H:i')
                    ->sortable(),

                Tables\Columns\TextColumn::make('check_out_at')
                    ->label('Check Out')
                    ->dateTime('H:i')
                    ->placeholder('Active (In Session)')
                    ->sortable(),

                Tables\Columns\TextColumn::make('total_worked_minutes')
                    ->label('Worked Duration (Hrs & Mins)')
                    ->formatStateUsing(function ($state) {
                        if (!$state) return '0h 0m (0 mins)';
                        $hours = floor($state / 60);
                        $mins = $state % 60;
                        return "{$hours}h {$mins}m ({$state} mins)";
                    })
                    ->sortable(),

                Tables\Columns\TextColumn::make('salary_type_snapshot')
                    ->label('Rate Snapshot')
                    ->badge()
                    ->formatStateUsing(function ($state, StaffAttendance $record) {
                        return match ($state) {
                            'hourly' => 'Hourly ($' . number_format($record->hourly_rate_snapshot ?? 0, 2) . '/hr)',
                            'minutly' => 'Minutly ($' . number_format($record->minutly_rate_snapshot ?? 0, 4) . '/min)',
                            'monthly' => 'Monthly ($' . number_format($record->monthly_salary_snapshot ?? 0, 2) . '/mo)',
                            default => ucfirst($state ?? 'Standard'),
                        };
                    })
                    ->color('secondary'),

                Tables\Columns\TextColumn::make('calculated_pay')
                    ->label('Calculated Pay')
                    ->money('USD')
                    ->sortable(),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'present' => 'success',
                        'late' => 'warning',
                        'overtime' => 'info',
                        'half_day' => 'warning',
                        'on_leave' => 'gray',
                        'absent' => 'danger',
                        default => 'primary',
                    }),
            ])
            ->defaultSort('attendance_date', 'desc')
            ->actions([
                Tables\Actions\EditAction::make('edit_self')
                    ->label('Edit')
                    ->icon('heroicon-o-pencil')
                    ->form([
                        Forms\Components\DateTimePicker::make('check_in_at')
                            ->label('Check-In Time')
                            ->required(),

                        Forms\Components\DateTimePicker::make('check_out_at')
                            ->label('Check-Out Time'),

                        Forms\Components\TextInput::make('break_duration_minutes')
                            ->label('Break (Minutes)')
                            ->numeric()
                            ->default(0),

                        Forms\Components\Textarea::make('notes')
                            ->rows(2),
                    ])
                    ->after(function (StaffAttendance $record) {
                        $record->syncWorkedMinutesAndPay();
                        $record->save();
                    }),
            ]);
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('self_check_in')
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
                        ->title('Checked In')
                        ->body('Check-in time recorded: ' . now()->format('H:i'))
                        ->success()
                        ->send();
                }),

            Actions\Action::make('self_check_out')
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
                            ->title('No Active Session Found')
                            ->danger()
                            ->send();
                        return;
                    }

                    $record->check_out_at = now();
                    $record->syncWorkedMinutesAndPay();
                    $record->save();

                    $hours = floor($record->total_worked_minutes / 60);
                    $mins = $record->total_worked_minutes % 60;

                    Notification::make()
                        ->title('Checked Out')
                        ->body("Worked: {$hours}h {$mins}m. Pay: \${$record->calculated_pay}")
                        ->success()
                        ->send();
                }),

            Actions\Action::make('log_self_attendance')
                ->label('Log Custom Self Time')
                ->icon('heroicon-o-plus-circle')
                ->color('info')
                ->form([
                    Forms\Components\DatePicker::make('attendance_date')
                        ->label('Date')
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
                        ->label('Notes')
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

                    Notification::make()
                        ->title('Saved')
                        ->body("Attendance saved: {$record->total_worked_minutes} mins worked.")
                        ->success()
                        ->send();
                }),
        ];
    }
}
