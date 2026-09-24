<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\StaffPayrollResource\Pages;
use App\Models\StaffPayroll;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;
use Filament\Tables\Filters\SelectFilter;

class StaffPayrollResource extends BaseAcademyResource
{
    protected static ?string $model = StaffPayroll::class;

    protected static ?string $navigationIcon = 'heroicon-o-banknotes';

    protected static ?string $navigationLabel = 'Staff Payroll';

    protected static ?string $modelLabel = 'Staff Payroll';

    protected static ?string $pluralModelLabel = 'Staff Payrolls';

    protected static ?string $navigationGroup = 'FINANCE';

    protected static ?int $navigationSort = 3;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();

        return parent::getEloquentQuery()
            ->forAcademy($user->academy_id)
            ->with(['user', 'generatedBy']);
    }

    public static function form(Form $form): Form
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return $form
            ->schema([
                Section::make('Payroll Identification & Period')
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

                            Forms\Components\Select::make('salary_type')
                                ->label('Salary Type')
                                ->options([
                                    'hourly' => 'Hourly Rate',
                                    'minutly' => 'Minutly Rate',
                                    'monthly' => 'Monthly Salary',
                                ])
                                ->required(),
                        ]),

                        Grid::make(2)->schema([
                            Forms\Components\DatePicker::make('period_start_date')
                                ->label('Period Start Date')
                                ->required(),

                            Forms\Components\DatePicker::make('period_end_date')
                                ->label('Period End Date')
                                ->required(),
                        ]),
                    ]),

                Section::make('Work Summary & Financial Breakdown')
                    ->schema([
                        Grid::make(2)->schema([
                            Forms\Components\TextInput::make('total_days_worked')
                                ->label('Total Days Worked')
                                ->numeric()
                                ->default(0),

                            Forms\Components\TextInput::make('total_worked_minutes')
                                ->label('Total Worked Minutes')
                                ->numeric()
                                ->default(0),
                        ]),

                        Grid::make(4)->schema([
                            Forms\Components\TextInput::make('base_salary_amount')
                                ->label('Base Salary (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->default(0.00)
                                ->reactive()
                                ->afterStateUpdated(fn ($state, Forms\Set $set, $get) => $set('net_salary', (float)$state + (float)$get('overtime_amount') + (float)$get('allowances') - (float)$get('deductions'))),

                            Forms\Components\TextInput::make('overtime_amount')
                                ->label('Overtime (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->default(0.00)
                                ->reactive()
                                ->afterStateUpdated(fn ($state, Forms\Set $set, $get) => $set('net_salary', (float)$get('base_salary_amount') + (float)$state + (float)$get('allowances') - (float)$get('deductions'))),

                            Forms\Components\TextInput::make('allowances')
                                ->label('Allowances (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->default(0.00)
                                ->reactive()
                                ->afterStateUpdated(fn ($state, Forms\Set $set, $get) => $set('net_salary', (float)$get('base_salary_amount') + (float)$get('overtime_amount') + (float)$state - (float)$get('deductions'))),

                            Forms\Components\TextInput::make('deductions')
                                ->label('Deductions (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->default(0.00)
                                ->reactive()
                                ->afterStateUpdated(fn ($state, Forms\Set $set, $get) => $set('net_salary', (float)$get('base_salary_amount') + (float)$get('overtime_amount') + (float)$get('allowances') - (float)$state)),
                        ]),

                        Forms\Components\TextInput::make('net_salary')
                            ->label('Net Payable Salary (₹)')
                            ->numeric()
                            ->prefix('₹')
                            ->default(0.00)
                            ->required(),
                    ]),

                Section::make('Payment & Status')
                    ->schema([
                        Grid::make(3)->schema([
                            Forms\Components\Select::make('status')
                                ->options([
                                    'draft' => 'Draft',
                                    'approved' => 'Approved',
                                    'paid' => 'Paid',
                                ])
                                ->default('draft')
                                ->required(),

                            Forms\Components\DateTimePicker::make('paid_at')
                                ->label('Paid At'),

                            Forms\Components\TextInput::make('payment_method')
                                ->label('Payment Method')
                                ->placeholder('e.g. Bank Transfer, Cash, Check'),
                        ]),

                        Forms\Components\Textarea::make('notes')
                            ->rows(2)
                            ->columnSpanFull(),
                    ]),

                Forms\Components\Hidden::make('academy_id')
                    ->default($academyId),

                Forms\Components\Hidden::make('generated_by')
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

                Tables\Columns\TextColumn::make('period_start_date')
                    ->label('Start')
                    ->date()
                    ->sortable(),

                Tables\Columns\TextColumn::make('period_end_date')
                    ->label('End')
                    ->date()
                    ->sortable(),

                Tables\Columns\TextColumn::make('salary_type')
                    ->badge()
                    ->color('secondary'),

                Tables\Columns\TextColumn::make('total_days_worked')
                    ->label('Days Worked')
                    ->sortable(),

                Tables\Columns\TextColumn::make('total_worked_minutes')
                    ->label('Total Time')
                    ->formatStateUsing(function ($state) {
                        $hours = floor($state / 60);
                        $mins = $state % 60;
                        return "{$hours}h {$mins}m";
                    }),

                Tables\Columns\TextColumn::make('base_salary_amount')
                    ->label('Base Pay')
                    ->money('INR'),

                Tables\Columns\TextColumn::make('net_salary')
                    ->label('Net Salary')
                    ->money('INR')
                    ->sortable(),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'paid' => 'success',
                        'approved' => 'info',
                        'draft' => 'warning',
                        default => 'primary',
                    }),
            ])
            ->defaultSort('period_end_date', 'desc')
            ->filters([
                SelectFilter::make('user_id')
                    ->label('Staff Member')
                    ->options(function () {
                        $user = Auth::user();
                        return User::where('academy_id', $user->academy_id)
                            ->where('is_super_admin', false)
                            ->pluck('name', 'id');
                    }),

                SelectFilter::make('status')
                    ->options([
                        'draft' => 'Draft',
                        'approved' => 'Approved',
                        'paid' => 'Paid',
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make('download_pdf')
                    ->label('PDF Payslip')
                    ->icon('heroicon-o-document-arrow-down')
                    ->color('info')
                    ->action(function (StaffPayroll $record) {
                        $user = $record->user;
                        $academy = $record->academy;

                        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('receipts.staff-payslip', [
                            'payroll' => $record,
                            'user' => $user,
                            'academy' => $academy,
                        ]);

                        return response()->streamDownload(
                            fn () => print($pdf->output()),
                            "Payslip_{$user?->name}_{$record->period_start_date?->format('Y-m-d')}.pdf"
                        );
                    }),

                Tables\Actions\Action::make('mark_as_paid')
                    ->label('Mark Paid')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (StaffPayroll $record) => $record->status !== 'paid')
                    ->action(function (StaffPayroll $record) {
                        $record->update([
                            'status' => 'paid',
                            'paid_at' => now(),
                        ]);

                        Notification::make()
                            ->title('Payroll Marked as Paid')
                            ->success()
                            ->send();
                    }),

                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->headerActions([
                Tables\Actions\Action::make('export_csv')
                    ->label('Export Payrolls (CSV)')
                    ->icon('heroicon-o-arrow-down-tray')
                    ->color('secondary')
                    ->action(function () {
                        $user = Auth::user();
                        $payrolls = StaffPayroll::where('academy_id', $user->academy_id)->with('user')->get();

                        $csvData = "ID,Staff Name,Email,Salary Type,Period Start,Period End,Days Worked,Total Minutes,Base Pay,Net Salary,Status\n";

                        foreach ($payrolls as $p) {
                            $csvData .= "\"{$p->id}\",\"{$p->user?->name}\",\"{$p->user?->email}\",\"{$p->salary_type}\",\"{$p->period_start_date?->format('Y-m-d')}\",\"{$p->period_end_date?->format('Y-m-d')}\",\"{$p->total_days_worked}\",\"{$p->total_worked_minutes}\",\"{$p->base_salary_amount}\",\"{$p->net_salary}\",\"{$p->status}\"\n";
                        }

                        return response()->streamDownload(
                            fn () => print($csvData),
                            "Staff_Payrolls_Export_" . now()->format('Y-m-d') . ".csv"
                        );
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListStaffPayrolls::route('/'),
            'create' => Pages\CreateStaffPayroll::route('/create'),
            'edit' => Pages\EditStaffPayroll::route('/{record}/edit'),
        ];
    }
}
