<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\StaffAttendanceResource\Pages;
use App\Models\StaffAttendance;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use Filament\Notifications\Notification;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\Filter;

class StaffAttendanceResource extends BaseAcademyResource
{
    protected static ?string $model = StaffAttendance::class;

    protected static ?string $navigationIcon = 'heroicon-o-clock';

    protected static ?string $navigationLabel = 'Staff Attendance';

    protected static ?string $modelLabel = 'Staff Attendance';

    protected static ?string $pluralModelLabel = 'Staff Attendances';

    protected static ?string $navigationGroup = 'Staff Management';

    protected static ?int $navigationSort = 1;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();

        return parent::getEloquentQuery()
            ->forAcademy($user->academy_id)
            ->with(['user', 'markedBy']);
    }

    public static function form(Form $form): Form
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return $form
            ->schema([
                Section::make('Attendance Record')
                    ->schema([
                        Grid::make(2)->schema([
                            Forms\Components\Select::make('user_id')
                                ->label('Staff Member')
                                ->options(function () use ($academyId) {
                                    return User::where('academy_id', $academyId)
                                        ->where('is_super_admin', false)
                                        ->pluck('name', 'id');
                                })
                                ->searchable()
                                ->required()
                                ->reactive()
                                ->afterStateUpdated(function ($state, Forms\Set $set) {
                                    if ($state) {
                                        $staff = User::find($state);
                                        if ($staff) {
                                            $set('salary_type_snapshot', $staff->salary_type ?: 'monthly');
                                            $set('hourly_rate_snapshot', $staff->hourly_rate);
                                            $set('minutly_rate_snapshot', $staff->minutly_rate);
                                            $set('monthly_salary_snapshot', $staff->monthly_salary);
                                        }
                                    }
                                }),

                            Forms\Components\DatePicker::make('attendance_date')
                                ->label('Date')
                                ->default(now())
                                ->required(),
                        ]),

                        Grid::make(3)->schema([
                            Forms\Components\DateTimePicker::make('check_in_at')
                                ->label('Check-In Time')
                                ->default(now())
                                ->required(),

                            Forms\Components\DateTimePicker::make('check_out_at')
                                ->label('Check-Out Time'),

                            Forms\Components\TextInput::make('break_duration_minutes')
                                ->label('Break (Minutes)')
                                ->numeric()
                                ->default(0),
                        ]),

                        Grid::make(2)->schema([
                            Forms\Components\Select::make('status')
                                ->options([
                                    'present' => 'Present',
                                    'absent' => 'Absent',
                                    'half_day' => 'Half Day',
                                    'on_leave' => 'On Leave',
                                    'late' => 'Late',
                                    'overtime' => 'Overtime',
                                ])
                                ->default('present')
                                ->required(),

                            Forms\Components\TextInput::make('total_worked_minutes')
                                ->label('Total Worked Minutes')
                                ->numeric()
                                ->disabled()
                                ->dehydrated(false)
                                ->helperText('Automatically calculated upon check-out'),
                        ]),

                        Forms\Components\Textarea::make('notes')
                            ->rows(2)
                            ->columnSpanFull(),
                    ]),

                Section::make('Salary Snapshot & Calculated Pay')
                    ->description('Pay is automatically calculated based on salary type (Hourly, Minutly, Monthly) and work duration')
                    ->collapsible()
                    ->schema([
                        Grid::make(3)->schema([
                            Forms\Components\Select::make('salary_type_snapshot')
                                ->label('Salary Type Snapshot')
                                ->options([
                                    'hourly' => 'Hourly Rate',
                                    'minutly' => 'Minutly Rate',
                                    'monthly' => 'Monthly Salary',
                                ])
                                ->required(),

                            Forms\Components\TextInput::make('hourly_rate_snapshot')
                                ->label('Hourly Rate Snapshot (₹)')
                                ->numeric()
                                ->prefix('₹'),

                            Forms\Components\TextInput::make('minutly_rate_snapshot')
                                ->label('Minutly Rate Snapshot (₹)')
                                ->numeric()
                                ->prefix('₹'),
                        ]),

                        Grid::make(2)->schema([
                            Forms\Components\TextInput::make('monthly_salary_snapshot')
                                ->label('Monthly Base Salary Snapshot (₹)')
                                ->numeric()
                                ->prefix('₹'),

                            Forms\Components\TextInput::make('calculated_pay')
                                ->label('Calculated Pay (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->helperText('Auto-calculated based on worked time and rates'),
                        ]),
                    ]),

                Forms\Components\Hidden::make('academy_id')
                    ->default($academyId),

                Forms\Components\Hidden::make('marked_by')
                    ->default($user->id),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('user.name')
                    ->label('Staff Member')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('attendance_date')
                    ->label('Date')
                    ->date('d/m/Y')
                    ->sortable(),

                Tables\Columns\TextColumn::make('check_in_at')
                    ->label('Check-In')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),

                Tables\Columns\TextColumn::make('check_out_at')
                    ->label('Check-Out')
                    ->dateTime('d/m/Y H:i')
                    ->placeholder('Active (Checked In)')
                    ->sortable(),

                Tables\Columns\TextColumn::make('scheduled_minutes')
                    ->label('Scheduled')
                    ->formatStateUsing(fn ($state) => $state ? floor($state / 60) . 'h ' . ($state % 60) . 'm' : '5h 0m'),

                Tables\Columns\TextColumn::make('actual_minutes')
                    ->label('Actual Worked')
                    ->formatStateUsing(fn ($state) => $state ? floor($state / 60) . 'h ' . ($state % 60) . 'm' : '0m'),

                Tables\Columns\TextColumn::make('extra_minutes')
                    ->label('Extra Time')
                    ->formatStateUsing(fn ($state) => $state > 0 ? '+' . floor($state / 60) . 'h ' . ($state % 60) . 'm' : '0m')
                    ->color(fn ($state) => $state > 0 ? 'warning' : 'gray'),

                Tables\Columns\TextColumn::make('payable_minutes')
                    ->label('Payable Time')
                    ->formatStateUsing(fn ($state) => $state ? floor($state / 60) . 'h ' . ($state % 60) . 'm' : '0m')
                    ->sortable(),

                Tables\Columns\TextColumn::make('overtime_status')
                    ->label('Overtime Approval')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'approved' => 'success',
                        'auto_approved' => 'success',
                        'pending_approval' => 'warning',
                        'rejected' => 'danger',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'present' => 'success',
                        'late' => 'warning',
                        'overtime' => 'info',
                        'half_day' => 'warning',
                        'on_leave' => 'gray',
                        'pending_approval' => 'warning',
                        'absent' => 'danger',
                        default => 'primary',
                    }),

                Tables\Columns\TextColumn::make('calculated_pay')
                    ->label('Calculated Pay')
                    ->money('INR')
                    ->sortable(),
            ])
            ->defaultSort('attendance_date', 'desc')
            ->filters([
                SelectFilter::make('user_id')
                    ->label('Staff Member')
                    ->options(function () {
                        $user = Auth::user();
                        return User::where('academy_id', $user->academy_id)
                            ->where('is_super_admin', false)
                            ->pluck('name', 'id');
                    }),

                SelectFilter::make('overtime_status')
                    ->label('Approval Status')
                    ->options([
                        'pending_approval' => 'Pending Approval',
                        'approved' => 'Approved',
                        'auto_approved' => 'Auto Approved',
                        'rejected' => 'Rejected',
                        'none' => 'None',
                    ]),

                SelectFilter::make('status')
                    ->options([
                        'present' => 'Present',
                        'absent' => 'Absent',
                        'half_day' => 'Half Day',
                        'on_leave' => 'On Leave',
                        'pending_approval' => 'Pending Approval',
                        'overtime' => 'Overtime',
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make('approve_overtime')
                    ->label('Approve Overtime')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (StaffAttendance $record) => $record->overtime_status === 'pending_approval' || $record->status === 'pending_approval')
                    ->action(function (StaffAttendance $record) {
                        $record->approveOvertime(Auth::user());

                        Notification::make()
                            ->title('Overtime Approved')
                            ->body("Approved {$record->extra_minutes} extra mins. Payable Pay: ₹{$record->calculated_pay}")
                            ->success()
                            ->send();
                    }),

                Tables\Actions\Action::make('reject_overtime')
                    ->label('Reject Overtime')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (StaffAttendance $record) => $record->overtime_status === 'pending_approval' || $record->status === 'pending_approval')
                    ->action(function (StaffAttendance $record) {
                        $record->rejectOvertime(Auth::user());

                        Notification::make()
                            ->title('Overtime Rejected')
                            ->body("Extra hours rejected. Pay calculated on scheduled time only.")
                            ->warning()
                            ->send();
                    }),

                Tables\Actions\Action::make('check_out')
                    ->label('Check Out Now')
                    ->icon('heroicon-o-arrow-right-on-rectangle')
                    ->color('warning')
                    ->visible(fn (StaffAttendance $record) => is_null($record->check_out_at))
                    ->action(function (StaffAttendance $record) {
                        $record->check_out_at = now();
                        $record->syncWorkedMinutesAndPay();
                        $record->save();

                        Notification::make()
                            ->title('Checked Out')
                            ->body("Staff checked out. Worked: {$record->actual_minutes} mins.")
                            ->success()
                            ->send();
                    }),

                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->headerActions([
                Tables\Actions\Action::make('export_csv')
                    ->label('Export Attendances (CSV)')
                    ->icon('heroicon-o-arrow-down-tray')
                    ->color('secondary')
                    ->action(function () {
                        $user = Auth::user();
                        $attendances = StaffAttendance::where('academy_id', $user->academy_id)->with('user')->get();

                        $csvData = "ID,Staff Name,Email,Date,Check In,Check Out,Break Minutes,Worked Minutes,Status,Salary Type,Calculated Pay\n";

                        foreach ($attendances as $a) {
                            $csvData .= "\"{$a->id}\",\"{$a->user?->name}\",\"{$a->user?->email}\",\"{$a->attendance_date?->format('Y-m-d')}\",\"{$a->check_in_at?->format('H:i:s')}\",\"{$a->check_out_at?->format('H:i:s')}\",\"{$a->break_duration_minutes}\",\"{$a->total_worked_minutes}\",\"{$a->status}\",\"{$a->salary_type_snapshot}\",\"{$a->calculated_pay}\"\n";
                        }

                        return response()->streamDownload(
                            fn () => print($csvData),
                            "Staff_Attendances_Export_" . now()->format('Y-m-d') . ".csv"
                        );
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListStaffAttendances::route('/'),
            'create' => Pages\CreateStaffAttendance::route('/create'),
            'edit' => Pages\EditStaffAttendance::route('/{record}/edit'),
        ];
    }
}
