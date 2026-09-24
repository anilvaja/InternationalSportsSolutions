<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\StaffAttendanceSettingResource\Pages;
use App\Models\StaffAttendanceSetting;
use App\Models\StaffScheduleSlot;
use App\Models\User;
use App\Models\Branch;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;
use Filament\Tables\Filters\SelectFilter;
use Filament\Notifications\Notification;

class StaffAttendanceSettingResource extends BaseAcademyResource
{
    protected static ?string $model = StaffAttendanceSetting::class;

    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static ?string $navigationLabel = 'Staff Attendance Rules';

    protected static ?string $modelLabel = 'Staff Attendance Setting';

    protected static ?string $pluralModelLabel = 'Staff Attendance Settings';

    protected static ?string $navigationGroup = 'STAFF MANAGEMENT';

    protected static ?int $navigationSort = 4;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();

        return parent::getEloquentQuery()
            ->forAcademy($user->academy_id)
            ->with(['user', 'approvalAuthorityUser', 'branch']);
    }

    public static function form(Form $form): Form
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return $form
            ->schema([
                Section::make('Staff & Salary Rule Assignment')
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
                                ->required(),

                            Forms\Components\Select::make('branch_id')
                                ->label('Branch')
                                ->options(function () use ($academyId) {
                                    return Branch::where('academy_id', $academyId)
                                        ->pluck('name', 'id');
                                })
                                ->searchable(),
                        ]),

                        Grid::make(3)->schema([
                            Forms\Components\Select::make('salary_type')
                                ->label('Salary Type')
                                ->options([
                                    'monthly' => 'Monthly Salary',
                                    'hourly' => 'Hourly Rate',
                                    'minutly' => 'Minutly Rate',
                                    'daily' => 'Daily Rate',
                                    'custom' => 'Custom Contract',
                                ])
                                ->default('monthly')
                                ->required(),

                            Forms\Components\TextInput::make('salary_amount')
                                ->label('Salary Amount (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->default(0.00),

                            Forms\Components\DatePicker::make('effective_from')
                                ->label('Effective From')
                                ->default(now()),
                        ]),
                    ]),

                Section::make('Working Hours & Overtime Rules')
                    ->schema([
                        Grid::make(3)->schema([
                            Forms\Components\TextInput::make('expected_daily_hours')
                                ->label('Expected Hours / Day')
                                ->numeric()
                                ->default(5.00)
                                ->suffix('hrs')
                                ->reactive()
                                ->afterStateUpdated(fn ($state, Forms\Set $set) => $set('expected_daily_minutes', (int)($state * 60))),

                            Forms\Components\TextInput::make('expected_daily_minutes')
                                ->label('Expected Minutes / Day')
                                ->numeric()
                                ->default(300)
                                ->suffix('mins'),

                            Forms\Components\TextInput::make('working_days_per_month')
                                ->label('Working Days / Month')
                                ->numeric()
                                ->default(26),
                        ]),

                        Grid::make(3)->schema([
                            Forms\Components\Toggle::make('overtime_applicable')
                                ->label('Overtime Applicable')
                                ->default(true),

                            Forms\Components\TextInput::make('overtime_rate_multiplier')
                                ->label('Overtime Multiplier')
                                ->numeric()
                                ->default(1.50)
                                ->suffix('x'),

                            Forms\Components\TextInput::make('overtime_hourly_rate')
                                ->label('Overtime Hourly Rate (₹)')
                                ->numeric()
                                ->prefix('₹'),
                        ]),
                    ]),

                Section::make('Approval Authority & Threshold Settings')
                    ->description('Assign the specific admin/approver and threshold time for extended attendance approval')
                    ->schema([
                        Grid::make(3)->schema([
                            Forms\Components\Select::make('approval_authority_user_id')
                                ->label('Assigned Approver (Admin / Branch Manager)')
                                ->options(function () use ($academyId) {
                                    return User::where('academy_id', $academyId)
                                        ->pluck('name', 'id');
                                })
                                ->searchable()
                                ->required()
                                ->helperText('Select the specific admin or branch manager responsible for approving extended attendance timings'),

                            Forms\Components\TextInput::make('approval_threshold_minutes')
                                ->label('Approval Threshold (Minutes)')
                                ->numeric()
                                ->default(30)
                                ->suffix('mins')
                                ->helperText('Extra hours ≤ threshold are auto-approved; > threshold require approval'),

                            Forms\Components\TextInput::make('max_backdate_days')
                                ->label('Allowed Backdate Days')
                                ->numeric()
                                ->default(2)
                                ->suffix('days')
                                ->required()
                                ->helperText('Maximum past days staff can self-log directly. Dates older require approval (default: 2)'),
                        ]),

                        Forms\Components\Hidden::make('approval_authority_type')
                            ->default('specific_user'),
                    ]),

                Section::make('Salary Visibility, Cycle & Organization Leave Quotas')
                    ->description('Configure salary visibility dates, payroll cycle range, weekly work schedule, and leave quotas')
                    ->schema([
                        Grid::make(3)->schema([
                            Forms\Components\TextInput::make('salary_visibility_day')
                                ->label('Salary Visibility Date (Day of Month)')
                                ->numeric()
                                ->minValue(1)
                                ->maxValue(31)
                                ->default(5)
                                ->required()
                                ->helperText('Date of the month when salary details become visible to staff (e.g. 5th)'),

                            Forms\Components\TextInput::make('salary_cycle_start_day')
                                ->label('Salary Cycle Start Day')
                                ->numeric()
                                ->minValue(1)
                                ->maxValue(31)
                                ->default(1)
                                ->required()
                                ->helperText('Default start day of monthly calculation cycle (e.g. 1st)'),

                            Forms\Components\TextInput::make('salary_cycle_end_day')
                                ->label('Salary Cycle End Day')
                                ->numeric()
                                ->minValue(1)
                                ->maxValue(31)
                                ->default(31)
                                ->required()
                                ->helperText('Default end day of monthly calculation cycle (e.g. 31st or 30th)'),
                        ]),

                        Grid::make(3)->schema([
                            Forms\Components\Select::make('weekly_working_days')
                                ->label('Weekly Working Pattern')
                                ->options([
                                    5 => '5 Days / Week (Mon - Fri)',
                                    6 => '6 Days / Week (Mon - Sat)',
                                ])
                                ->default(6)
                                ->required()
                                ->helperText('Determines total working days per month for daily rate division'),

                            Forms\Components\TextInput::make('fix_paid_leaves_per_year')
                                ->label('Annual Fixed Paid Leaves')
                                ->numeric()
                                ->default(12)
                                ->suffix('days')
                                ->required()
                                ->helperText('Fixed organization paid leaves per year'),

                            Forms\Components\TextInput::make('flexible_leaves_per_year')
                                ->label('Annual Flexible Religious Leaves')
                                ->numeric()
                                ->default(4)
                                ->suffix('days')
                                ->required()
                                ->helperText('Religious / optional holiday quota staff can claim per year'),
                        ]),
                    ]),

                Forms\Components\Hidden::make('academy_id')
                    ->default($academyId),
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

                Tables\Columns\TextColumn::make('branch.name')
                    ->label('Branch')
                    ->placeholder('All Branches')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('salary_type')
                    ->label('Salary Type')
                    ->badge()
                    ->color('secondary'),

                Tables\Columns\TextColumn::make('salary_amount')
                    ->label('Salary Amount')
                    ->money('INR')
                    ->sortable(),

                Tables\Columns\TextColumn::make('expected_daily_hours')
                    ->label('Expected Hours')
                    ->suffix(' hrs')
                    ->sortable(),

                Tables\Columns\TextColumn::make('approvalAuthorityUser.name')
                    ->label('Assigned Approver')
                    ->placeholder('Academy Admin')
                    ->badge()
                    ->color('info'),

                Tables\Columns\TextColumn::make('approval_threshold_minutes')
                    ->label('Threshold')
                    ->suffix(' mins'),

                Tables\Columns\TextColumn::make('max_backdate_days')
                    ->label('Allowed Backdate')
                    ->suffix(' days')
                    ->sortable(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListStaffAttendanceSettings::route('/'),
            'create' => Pages\CreateStaffAttendanceSetting::route('/create'),
            'edit' => Pages\EditStaffAttendanceSetting::route('/{record}/edit'),
        ];
    }
}
