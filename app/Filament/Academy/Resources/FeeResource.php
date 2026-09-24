<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\FeeResource\Pages;
use App\Models\Fee;
use App\Models\Student;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

class FeeResource extends BaseAcademyResource
{
    protected static ?string $model = Fee::class;

    protected static ?string $navigationIcon = 'heroicon-o-banknotes';
    
    protected static ?string $navigationLabel = 'Fee Collection';
    
    protected static ?string $navigationGroup = 'FINANCE';
    
    protected static ?int $navigationSort = 1;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return parent::getEloquentQuery()
            ->where('academy_id', $academyId)
            ->with(['student', 'batch']);
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Hidden::make('academy_id')
                    ->default(Auth::user()->academy_id),
                
                Forms\Components\Hidden::make('branch_id')
                    ->default(function ($record) {
                        return $record ? $record->branch_id : null;
                    }),
                    
                Forms\Components\Hidden::make('collected_by')
                    ->default(Auth::id()),

                Forms\Components\Section::make('Student & Batch Information')
                    ->description('Select a student to automatically load their active batch and fee details.')
                    ->schema([
                        Forms\Components\Select::make('student_id')
                            ->label('Student')
                            ->relationship(
                                name: 'student',
                                titleAttribute: 'first_name',
                                modifyQueryUsing: fn (Builder $query) => $query->where('academy_id', Auth::user()->academy_id)
                            )
                            ->getOptionLabelFromRecordUsing(fn (Student $record): string => 
                                "{$record->first_name} {$record->last_name} - {$record->student_id}")
                            ->searchable(['first_name', 'last_name', 'student_id'])
                            ->preload()
                            ->required()
                            ->reactive()
                            ->afterStateUpdated(function (callable $get, callable $set, $state) {
                                if (!$state) {
                                    $set('batch_id', null);
                                    $set('batch_name', null);
                                    $set('monthly_fee_rate', 0);
                                    $set('original_fee_amount', 0);
                                    $set('monthly_fee_display', null);
                                    $set('fees_amount', null);
                                    $set('branch_id', null);
                                    $set('total_paid_fees', null);
                                    $set('fees_from_date', null);
                                    $set('fees_to_date', null);
                                    $set('is_discount_applied', false);
                                    $set('discount_amount', null);
                                    return;
                                }
                                
                                $student = Student::with(['activeBatches.branch', 'fees'])->find($state);
                                if ($student && $activeBatch = $student->activeBatches->first()) {
                                    $set('batch_id', $activeBatch->id);
                                    $set('batch_name', $activeBatch->name);
                                    $set('monthly_fee_rate', $activeBatch->monthly_fee);
                                    
                                    // Calculate total fee amount based on months paid
                                    $monthsPaid = (int) ($get('months_paid') ?? 1);
                                    $originalAmount = $activeBatch->monthly_fee * $monthsPaid;
                                    $set('original_fee_amount', $originalAmount);
                                    $set('fees_amount', $originalAmount);
                                    
                                    $set('branch_id', $activeBatch->branch_id);
                                    
                                    // Calculate total paid fees for this student
                                    $totalPaid = $student->fees()->where('status', 'paid')->sum('fees_amount');
                                    $set('total_paid_fees', $totalPaid);
                                    
                                    // Always calculate the correct start date based on payment history
                                    $lastPayment = $student->fees()
                                        ->where('status', 'paid')
                                        ->orderBy('fees_to_date', 'desc')
                                        ->first();
                                    
                                    if ($lastPayment) {
                                        // Subsequent payment - set next date after last payment
                                        $nextStartDate = \Carbon\Carbon::parse($lastPayment->fees_to_date)->addDay();
                                        $set('fees_from_date', $nextStartDate->format('Y-m-d'));
                                        
                                        // Set helpful message for subsequent payments
                                        $lastPeriod = \Carbon\Carbon::parse($lastPayment->fees_to_date)->format('M d, Y');
                                        $set('payment_period_info', "Next installment - Last paid till {$lastPeriod}");
                                    } else {
                                        // First payment - set to batch start date
                                        $batchStartDate = $activeBatch->start_date ? 
                                            \Carbon\Carbon::parse($activeBatch->start_date)->format('Y-m-d') : 
                                            now()->format('Y-m-d');
                                        $set('fees_from_date', $batchStartDate);
                                        $set('payment_period_info', 'First payment for this student');
                                    }
                                    
                                    // Calculate end date based on start date and months paid
                                    $startDate = $get('fees_from_date');
                                    if ($startDate) {
                                        $monthsPaid = (int) ($get('months_paid') ?? 1);
                                        $endDate = \Carbon\Carbon::parse($startDate)->addMonths($monthsPaid)->subDay();
                                        $set('fees_to_date', $endDate->format('Y-m-d'));
                                    }
                                }
                            }),

                        Forms\Components\TextInput::make('batch_name')
                            ->label('Current Batch')
                            ->disabled()
                            ->dehydrated(false)
                            ->placeholder('Select student first')
                            ->formatStateUsing(function ($record, callable $get) {
                                if ($record && $record->batch) {
                                    return $record->batch->name;
                                }
                                return null;
                            }),
                            
                        Forms\Components\TextInput::make('monthly_fee_display')
                            ->label('Monthly Fee Rate')
                            ->disabled()
                            ->dehydrated(false)
                            ->prefix('₹')
                            ->placeholder('₹0.00')
                            ->formatStateUsing(function ($record, callable $get) {
                                if ($record && $record->batch) {
                                    return number_format($record->batch->monthly_fee, 2);
                                }
                                $monthlyFee = $get('monthly_fee_rate');
                                return $monthlyFee ? number_format($monthlyFee, 2) : '0.00';
                            }),
                            
                        Forms\Components\TextInput::make('total_paid_fees')
                            ->label('Total Paid Fees')
                            ->disabled()
                            ->dehydrated(false)
                            ->prefix('₹')
                            ->placeholder('₹0.00')
                            ->formatStateUsing(function ($record) {
                                if ($record && $record->student) {
                                    $totalPaid = $record->student->fees()->where('status', 'paid')->sum('fees_amount');
                                    return number_format($totalPaid, 2);
                                }
                                return '0.00';
                            }),

                        Forms\Components\TextInput::make('payment_period_info')
                            ->label('Payment Info')
                            ->disabled()
                            ->dehydrated(false)
                            ->placeholder('Select student to see payment history')
                            ->formatStateUsing(function ($record) {
                                if ($record && $record->student) {
                                    $lastPayment = $record->student->fees()
                                        ->where('status', 'paid')
                                        ->where('id', '!=', $record->id) // Exclude current record
                                        ->orderBy('fees_to_date', 'desc')
                                        ->first();
                                    
                                    if ($lastPayment) {
                                        $lastPeriod = \Carbon\Carbon::parse($lastPayment->fees_to_date)->format('M d, Y');
                                        return "Editing payment - Last paid till {$lastPeriod}";
                                    } else {
                                        return 'Editing first payment for this student';
                                    }
                                }
                                return null;
                            }),
                            
                        Forms\Components\Hidden::make('batch_id')
                            ->default(function ($record) {
                                return $record ? $record->batch_id : null;
                            }),
                    ])
                    ->columns(3),

                Forms\Components\Section::make('Fee Details')
                    ->schema([
                        Forms\Components\TextInput::make('receipt_number')
                            ->label('Receipt Number')
                            ->disabled()
                            ->dehydrated(false)
                            ->placeholder('Auto-generated'),

                        Forms\Components\Hidden::make('monthly_fee_rate')
                            ->default(function ($record) {
                                if ($record && $record->batch) {
                                    return $record->batch->monthly_fee;
                                }
                                return 0;
                            }),

                        Forms\Components\Hidden::make('original_fee_amount')
                            ->default(function ($record) {
                                if ($record && $record->batch) {
                                    return $record->batch->monthly_fee * $record->months_paid;
                                }
                                return 0;
                            }),

                        Forms\Components\TextInput::make('fees_amount')
                            ->label('Fee Amount (Net Payable)')
                            ->numeric()
                            ->prefix('₹')
                            ->required()
                            ->reactive()
                            ->helperText(function (callable $get) {
                                $originalAmount = (float) ($get('original_fee_amount') ?? 0);
                                $discountAmount = (float) ($get('discount_amount') ?? 0);
                                $isDiscountApplied = $get('is_discount_applied');
                                
                                if ($isDiscountApplied && $discountAmount > 0 && $originalAmount > 0) {
                                    return "Original: ₹" . number_format($originalAmount, 2) . " - Discount: ₹" . number_format($discountAmount, 2) . " = Net: ₹" . number_format($originalAmount - $discountAmount, 2);
                                }
                                return 'Auto-calculated: Monthly Fee × Months Paid';
                            }),

                        Forms\Components\TextInput::make('months_paid')
                            ->label('Months Paid')
                            ->numeric()
                            ->default(1)
                            ->minValue(1)
                            ->maxValue(12)
                            ->required()
                            ->reactive()
                            ->afterStateUpdated(function (callable $get, callable $set, $state) {
                                // Recalculate fee amount based on monthly rate and months paid
                                $monthlyFeeRate = (float) ($get('monthly_fee_rate') ?? 0);
                                $monthsPaid = (int) ($state ?? 1);
                                
                                if ($monthlyFeeRate > 0) {
                                    $originalAmount = $monthlyFeeRate * $monthsPaid;
                                    $set('original_fee_amount', $originalAmount);
                                    
                                    // Apply discount if applicable
                                    $isDiscountApplied = $get('is_discount_applied');
                                    $discountAmount = (float) ($get('discount_amount') ?? 0);
                                    
                                    if ($isDiscountApplied && $discountAmount > 0) {
                                        $netAmount = $originalAmount - $discountAmount;
                                        $set('fees_amount', max(0, $netAmount)); // Ensure non-negative
                                    } else {
                                        $set('fees_amount', $originalAmount);
                                    }
                                }
                                
                                // Update end date based on start date and months paid
                                $startDate = $get('fees_from_date');
                                if ($startDate && $state) {
                                    $endDate = \Carbon\Carbon::parse($startDate)->addMonths((int) $state)->subDay();
                                    $set('fees_to_date', $endDate->format('Y-m-d'));
                                }
                            }),

                        Forms\Components\DatePicker::make('payment_date')
                            ->label('Payment Date')
                            ->default(now())
                            ->required(),

                        Forms\Components\DatePicker::make('fees_from_date')
                            ->label('Fee Period From')
                            ->required()
                            ->reactive()
                            ->live(onBlur: true)
                            ->helperText(function (callable $get) {
                                $studentId = $get('student_id');
                                if ($studentId) {
                                    $student = Student::find($studentId);
                                    if ($student && $student->fees()->where('status', 'paid')->exists()) {
                                        return 'Auto-calculated from last payment, but you can change it manually';
                                    } else {
                                        return 'Auto-filled with batch start date for first payment';
                                    }
                                }
                                return 'Select the start date for fee period (defaults to batch start date)';
                            })
                            ->afterStateUpdated(function (callable $get, callable $set, $state) {
                                $monthsPaid = (int) ($get('months_paid') ?? 1);
                                if ($state) {
                                    $endDate = \Carbon\Carbon::parse($state)->addMonths($monthsPaid)->subDay();
                                    $set('fees_to_date', $endDate->format('Y-m-d'));
                                }
                            }),

                        Forms\Components\DatePicker::make('fees_to_date')
                            ->label('Fee Period To')
                            ->required()
                            ->default(now()->addMonth()->subDay()->format('Y-m-d')),
                    ])
                    ->columns(3),

                Forms\Components\Section::make('Payment Information')
                    ->schema([
                        Forms\Components\Select::make('payment_mode')
                            ->label('Payment Mode')
                            ->options([
                                'cash' => 'Cash',
                                'cheque' => 'Cheque',
                                'online' => 'Online Transfer',
                                'upi' => 'UPI',
                                'card' => 'Credit/Debit Card',
                                'bank_transfer' => 'Bank Transfer',
                            ])
                            ->default('cash')
                            ->required()
                            ->reactive(),

                        Forms\Components\TextInput::make('transaction_reference')
                            ->label('Transaction Reference')
                            ->visible(fn (callable $get) => in_array($get('payment_mode'), ['cheque', 'online', 'upi', 'card', 'bank_transfer']))
                            ->required(fn (callable $get) => in_array($get('payment_mode'), ['cheque', 'online', 'upi', 'card', 'bank_transfer'])),

                        Forms\Components\Textarea::make('payment_note')
                            ->label('Payment Note')
                            ->maxLength(500)
                            ->columnSpanFull()
                            ->placeholder('Transaction details, reference numbers, etc.'),
                    ])
                    ->columns(2),

                Forms\Components\Section::make('Discount & Additional Information')
                    ->schema([
                        Forms\Components\Toggle::make('is_discount_applied')
                            ->label('Apply Discount')
                            ->reactive()
                            ->afterStateUpdated(function (callable $get, callable $set, $state) {
                                $originalAmount = (float) ($get('original_fee_amount') ?? 0);
                                
                                if (!$state) {
                                    // Discount removed - reset to original amount
                                    $set('fees_amount', $originalAmount);
                                    $set('discount_amount', null);
                                } else {
                                    // Discount applied - keep current discount calculation if any
                                    $discountAmount = (float) ($get('discount_amount') ?? 0);
                                    if ($discountAmount > 0) {
                                        $netAmount = $originalAmount - $discountAmount;
                                        $set('fees_amount', max(0, $netAmount));
                                    }
                                }
                            }),

                        Forms\Components\TextInput::make('discount_amount')
                            ->label('Discount Amount')
                            ->numeric()
                            ->prefix('₹')
                            ->visible(fn (callable $get) => $get('is_discount_applied'))
                            ->required(fn (callable $get) => $get('is_discount_applied'))
                            ->reactive()
                            ->afterStateUpdated(function (callable $get, callable $set, $state) {
                                $originalAmount = (float) ($get('original_fee_amount') ?? 0);
                                $discountAmount = (float) ($state ?? 0);
                                $isDiscountApplied = $get('is_discount_applied');
                                
                                if ($isDiscountApplied && $originalAmount > 0) {
                                    // Ensure discount doesn't exceed original amount
                                    if ($discountAmount > $originalAmount) {
                                        $discountAmount = $originalAmount;
                                        $set('discount_amount', $discountAmount);
                                    }
                                    
                                    $netAmount = $originalAmount - $discountAmount;
                                    $set('fees_amount', max(0, $netAmount));
                                }
                            })
                            ->helperText(function (callable $get) {
                                $originalAmount = (float) ($get('original_fee_amount') ?? 0);
                                return $originalAmount > 0 ? "Maximum discount: ₹" . number_format($originalAmount, 2) : '';
                            }),

                        Forms\Components\TextInput::make('discount_reason')
                            ->label('Discount Reason')
                            ->visible(fn (callable $get) => $get('is_discount_applied'))
                            ->required(fn (callable $get) => $get('is_discount_applied')),

                        Forms\Components\Select::make('status')
                            ->label('Payment Status')
                            ->options([
                                'paid' => 'Paid',
                                'pending' => 'Pending',
                                'overdue' => 'Overdue',
                                'cancelled' => 'Cancelled',
                            ])
                            ->default('paid')
                            ->required(),

                        Forms\Components\Textarea::make('fees_note')
                            ->label('Fee Notes')
                            ->maxLength(500)
                            ->columnSpanFull()
                            ->placeholder('Fee-related notes, reference numbers, etc.'),
                    ])
                    ->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('receipt_number')
                    ->label('Receipt No.')
                    ->searchable()
                    ->sortable(),
                    
                Tables\Columns\TextColumn::make('student.first_name')
                    ->label('Student')
                    ->formatStateUsing(fn ($record) => "{$record->student->first_name} {$record->student->last_name}")
                    ->searchable(['first_name', 'last_name'])
                    ->sortable(),
                    
                Tables\Columns\TextColumn::make('batch.name')
                    ->label('Batch')
                    ->sortable(),
                    
                Tables\Columns\TextColumn::make('fees_amount')
                    ->label('Amount')
                    ->money('INR')
                    ->sortable(),
                    
                Tables\Columns\TextColumn::make('months_paid')
                    ->label('Months')
                    ->badge()
                    ->color('success'),
                    
                Tables\Columns\TextColumn::make('payment_date')
                    ->label('Payment Date')
                    ->date()
                    ->sortable(),
                    
                Tables\Columns\TextColumn::make('fees_from_date')
                    ->label('Period From')
                    ->date(),
                    
                Tables\Columns\TextColumn::make('fees_to_date')
                    ->label('Period To')
                    ->date(),
                    
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'paid' => 'success',
                        'pending' => 'warning', 
                        'overdue' => 'danger',
                        'cancelled' => 'secondary',
                        default => 'secondary',
                    }),
                    
                Tables\Columns\TextColumn::make('payment_mode')
                    ->label('Payment Mode')
                    ->badge()
                    ->color('primary'),
                    
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'paid' => 'Paid',
                        'pending' => 'Pending',
                        'overdue' => 'Overdue',
                        'cancelled' => 'Cancelled',
                    ]),
                    
                Tables\Filters\SelectFilter::make('payment_mode')
                    ->options([
                        'cash' => 'Cash',
                        'cheque' => 'Cheque',
                        'online' => 'Online Transfer',
                        'upi' => 'UPI',
                        'card' => 'Credit/Debit Card',
                        'bank_transfer' => 'Bank Transfer',
                    ]),
                    
                Tables\Filters\Filter::make('payment_date_range')
                    ->form([
                        Forms\Components\DatePicker::make('from_date')
                            ->label('From Date'),
                        Forms\Components\DatePicker::make('to_date')
                            ->label('To Date'),
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        return $query
                            ->when(
                                $data['from_date'],
                                fn (Builder $query, $date): Builder => $query->whereDate('payment_date', '>=', $date),
                            )
                            ->when(
                                $data['to_date'],
                                fn (Builder $query, $date): Builder => $query->whereDate('payment_date', '<=', $date),
                            );
                    })
                    ->columns(2),
                    
                Tables\Filters\SelectFilter::make('student')
                    ->relationship('student', 'first_name')
                    ->searchable()
                    ->preload()
                    ->multiple()
                    ->label('Students'),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
                Tables\Actions\Action::make('print_receipt')
                    ->label('Print Receipt')
                    ->icon('heroicon-o-printer')
                    ->color('success')
                    ->url(fn ($record) => route('academy.fee.print', $record))
                    ->openUrlInNewTab()
                    ->visible(fn ($record) => $record->status === 'paid'),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->headerActions([
                Tables\Actions\CreateAction::make()
                    ->label('Collect Fee')
                    ->icon('heroicon-o-plus'),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListFees::route('/'),
            'create' => Pages\CreateFee::route('/create'),
            'view' => Pages\ViewFee::route('/{record}'),
            'edit' => Pages\EditFee::route('/{record}/edit'),
        ];
    }

    // Override permission name to match database permission names
    public static function getAcademyPermissionName(string $action): string
    {
        return $action . '_fees';
    }

    // Override permission methods to use correct permission names
    public static function canViewAny(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('view_fees');
    }

    public static function canCreate(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('create_fees');
    }

    public static function canEdit($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('edit_fees');
    }

    public static function canDelete($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('delete_fees');
    }
}
