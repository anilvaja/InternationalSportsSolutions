<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\EventFeeResource\Pages;
use App\Models\EventFee;
use App\Models\Event;
use App\Models\Student;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Filament\Tables\Actions\Action;
use Filament\Notifications\Notification;
use Filament\Forms\Components\Section;
use Illuminate\Support\Facades\Auth;
use App\Support\CurrencyHelper;

class EventFeeResource extends BaseAcademyResource
{
    protected static ?string $model = EventFee::class;
    protected static ?string $navigationIcon = 'heroicon-o-currency-dollar';
    protected static ?string $navigationLabel = 'Event Fees';
    protected static ?string $navigationGroup = 'Events Management';
    protected static ?int $navigationSort = 2;

    public static function canAccess(): bool
    {
        $user = Auth::user();
        
        if (!$user) {
            return false;
        }
        
        if ($user->is_super_admin) {
            return true;
        }
        
        // For now, allow all academy users
        return !is_null($user->academy_id);
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Fee Details')
                    ->schema([
                        Forms\Components\Select::make('event_id')
                            ->relationship('event', 'title', function ($query) {
                                $user = Auth::user();
                                if (!$user->is_super_admin && $user->academy_id) {
                                    $query->where('academy_id', $user->academy_id);
                                }
                            })
                            ->required()
                            ->searchable()
                            ->preload()
                            ->live()
                            ->afterStateUpdated(function ($state, callable $set, callable $get) {
                                if ($state) {
                                    $event = \App\Models\Event::find($state);
                                    if ($event && $event->fee > 0) {
                                        $set('amount', $event->fee);
                                        $set('final_amount', $event->fee);
                                        // Set due date to 7 days before event date
                                        if ($event->event_date) {
                                            $dueDate = $event->event_date->subDays(7);
                                            $set('due_date', $dueDate);
                                        }
                                    }
                                    
                                    // Validate that student and event belong to same academy
                                    $studentId = $get('student_id');
                                    if ($studentId) {
                                        $student = \App\Models\Student::find($studentId);
                                        
                                        if ($event && $student && $event->academy_id !== $student->academy_id) {
                                            $set('student_id', null);
                                            \Filament\Notifications\Notification::make()
                                                ->danger()
                                                ->title('Invalid Selection')
                                                ->body('Student and Event must belong to the same academy.')
                                                ->send();
                                        }
                                    }
                                }
                            }),
                        
                        Forms\Components\Select::make('student_id')
                            ->relationship('student', 'first_name', function ($query) {
                                $user = Auth::user();
                                if (!$user->is_super_admin && $user->academy_id) {
                                    $query->where('academy_id', $user->academy_id);
                                }
                            })
                            ->required()
                            ->searchable()
                            ->preload()
                            ->getOptionLabelFromRecordUsing(fn ($record) => "{$record->first_name} {$record->last_name} ({$record->student_id})")
                            ->live()
                            ->afterStateUpdated(function ($state, callable $get, callable $set) {
                                // Validate that student and event belong to same academy
                                $eventId = $get('event_id');
                                if ($eventId && $state) {
                                    $event = \App\Models\Event::find($eventId);
                                    $student = \App\Models\Student::find($state);
                                    
                                    if ($event && $student && $event->academy_id !== $student->academy_id) {
                                        $set('student_id', null);
                                        \Filament\Notifications\Notification::make()
                                            ->danger()
                                            ->title('Invalid Selection')
                                            ->body('Student and Event must belong to the same academy.')
                                            ->send();
                                    }
                                }
                            }),
                        
                        Forms\Components\TextInput::make('amount')
                            ->required()
                            ->numeric()
                            ->prefix(CurrencyHelper::getAcademyCurrencySymbol())
                            ->step(0.01)
                            ->live()
                            ->afterStateUpdated(function ($state, callable $set, callable $get) {
                                $amount = $state ?? 0;
                                $discountAmount = $get('discount_amount') ?? 0;
                                
                                // If discount exceeds new amount, adjust it
                                if ($discountAmount > $amount) {
                                    $discountAmount = $amount;
                                    $set('discount_amount', $discountAmount);
                                }
                                
                                $finalAmount = max(0, $amount - $discountAmount);
                                $set('final_amount', $finalAmount);
                            })
                            ->rules(['numeric', 'min:0']),
                        
                        Forms\Components\TextInput::make('discount_amount')
                            ->numeric()
                            ->prefix(CurrencyHelper::getAcademyCurrencySymbol())
                            ->step(0.01)
                            ->default(0)
                            ->live()
                            ->afterStateUpdated(function ($state, callable $set, callable $get) {
                                $amount = $get('amount') ?? 0;
                                $discountAmount = $state ?? 0;
                                
                                // Ensure discount doesn't exceed the original amount
                                if ($discountAmount > $amount) {
                                    $discountAmount = $amount;
                                    $set('discount_amount', $discountAmount);
                                }
                                
                                $finalAmount = max(0, $amount - $discountAmount);
                                $set('final_amount', $finalAmount);
                            })
                            ->rules(['numeric', 'min:0'])
                            ->helperText('Cannot exceed the original amount'),
                        
                        Forms\Components\TextInput::make('final_amount')
                            ->required()
                            ->numeric()
                            ->prefix(CurrencyHelper::getAcademyCurrencySymbol())
                            ->step(0.01)
                            ->disabled()
                            ->dehydrated()
                            ->helperText('Automatically calculated: Amount - Discount'),
                        
                        Forms\Components\DateTimePicker::make('due_date')
                            ->required(),
                    ])->columns(2),
                
                Section::make('Payment Information')
                    ->schema([
                        Forms\Components\Select::make('payment_status')
                            ->options([
                                'pending' => 'Pending',
                                'paid' => 'Paid',
                                'partial' => 'Partial Payment',
                                'overdue' => 'Overdue',
                                'refunded' => 'Refunded',
                                'cancelled' => 'Cancelled',
                            ])
                            ->required()
                            ->default('pending'),
                        
                        Forms\Components\Select::make('payment_method')
                            ->options([
                                'cash' => 'Cash',
                                'card' => 'Credit/Debit Card',
                                'bank_transfer' => 'Bank Transfer',
                                'check' => 'Check',
                                'online' => 'Online Payment',
                            ])
                            ->visible(fn ($get) => in_array($get('payment_status'), ['paid', 'partial'])),
                        
                        Forms\Components\DateTimePicker::make('payment_date')
                            ->visible(fn ($get) => in_array($get('payment_status'), ['paid', 'partial'])),
                        
                        Forms\Components\TextInput::make('payment_reference')
                            ->label('Payment Reference/Transaction ID')
                            ->visible(fn ($get) => in_array($get('payment_status'), ['paid', 'partial'])),
                        
                        Forms\Components\Textarea::make('payment_notes')
                            ->visible(fn ($get) => in_array($get('payment_status'), ['paid', 'partial'])),
                    ])->columns(2),
                
                Section::make('Discount & Refund')
                    ->schema([
                        Forms\Components\Textarea::make('discount_reason')
                            ->visible(fn ($get) => $get('discount_amount') > 0),
                        
                        Forms\Components\TextInput::make('refund_amount')
                            ->numeric()
                            ->prefix(CurrencyHelper::getAcademyCurrencySymbol())
                            ->step(0.01)
                            ->visible(fn ($get) => $get('payment_status') === 'refunded'),
                        
                        Forms\Components\DateTimePicker::make('refund_date')
                            ->visible(fn ($get) => $get('payment_status') === 'refunded'),
                        
                        Forms\Components\Textarea::make('refund_reason')
                            ->visible(fn ($get) => $get('payment_status') === 'refunded'),
                    ])->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('event.title')
                    ->label('Event')
                    ->searchable()
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('student.student_id')
                    ->label('Student ID')
                    ->searchable(),
                
                Tables\Columns\TextColumn::make('student.first_name')
                    ->label('Student Name')
                    ->formatStateUsing(fn ($record) => "{$record->student->first_name} {$record->student->last_name}")
                    ->searchable(['first_name', 'last_name']),
                
                Tables\Columns\TextColumn::make('amount')
                    ->label('Original Amount')
                    ->money(CurrencyHelper::getAcademyCurrency())
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('discount_amount')
                    ->label('Discount')
                    ->money(CurrencyHelper::getAcademyCurrency())
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('final_amount')
                    ->label('Final Amount')
                    ->money(CurrencyHelper::getAcademyCurrency())
                    ->sortable(),
                
                Tables\Columns\BadgeColumn::make('payment_status')
                    ->label('Status')
                    ->colors([
                        'warning' => 'pending',
                        'success' => 'paid',
                        'info' => 'partial',
                        'danger' => 'overdue',
                        'dark' => 'refunded',
                        'gray' => 'cancelled',
                    ]),
                
                Tables\Columns\TextColumn::make('due_date')
                    ->label('Due Date')
                    ->dateTime('d M Y')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('payment_date')
                    ->label('Payment Date')
                    ->dateTime('d M Y')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('payment_status')
                    ->options([
                        'pending' => 'Pending',
                        'paid' => 'Paid',
                        'partial' => 'Partial Payment',
                        'overdue' => 'Overdue',
                        'refunded' => 'Refunded',
                        'cancelled' => 'Cancelled',
                    ]),
                
                Tables\Filters\SelectFilter::make('event')
                    ->relationship('event', 'title', function ($query) {
                        $user = Auth::user();
                        if (!$user->is_super_admin && $user->academy_id) {
                            $query->where('academy_id', $user->academy_id);
                        }
                    })
                    ->searchable()
                    ->preload(),
                
                Tables\Filters\Filter::make('overdue')
                    ->query(fn (Builder $query) => $query->where('payment_status', 'overdue'))
                    ->label('Overdue Only'),
            ])
            ->actions([
                Action::make('mark_paid')
                    ->label('Mark as Paid')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn ($record) => in_array($record->payment_status, ['pending', 'partial', 'overdue']))
                    ->form([
                        Forms\Components\Select::make('payment_method')
                            ->options([
                                'cash' => 'Cash',
                                'card' => 'Credit/Debit Card',
                                'bank_transfer' => 'Bank Transfer',
                                'check' => 'Check',
                                'online' => 'Online Payment',
                            ])
                            ->required(),
                        Forms\Components\TextInput::make('payment_reference')
                            ->label('Payment Reference/Transaction ID'),
                        Forms\Components\Textarea::make('payment_notes'),
                    ])
                    ->action(function ($record, array $data) {
                        $record->markAsPaid(
                            $record->final_amount,
                            $data['payment_method'],
                            $data['payment_reference'] ?? null,
                            $data['payment_notes'] ?? null
                        );
                        
                        Notification::make()
                            ->success()
                            ->title('Payment Recorded')
                            ->body('Fee has been marked as paid successfully.')
                            ->send();
                    }),
                
                Action::make('apply_discount')
                    ->label('Apply Discount')
                    ->icon('heroicon-o-receipt-percent')
                    ->color('warning')
                    ->visible(fn ($record) => $record->payment_status !== 'paid')
                    ->form([
                        Forms\Components\TextInput::make('discount_amount')
                            ->required()
                            ->numeric()
                            ->prefix(CurrencyHelper::getAcademyCurrencySymbol())
                            ->step(0.01),
                        Forms\Components\Textarea::make('discount_reason')
                            ->required(),
                    ])
                    ->action(function ($record, array $data) {
                        $record->applyDiscount(
                            $data['discount_amount'],
                            $data['discount_reason']
                        );
                        
                        Notification::make()
                            ->success()
                            ->title('Discount Applied')
                            ->body('Discount has been applied to the fee.')
                            ->send();
                    }),
                
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    
                    Tables\Actions\BulkAction::make('mark_overdue')
                        ->label('Mark as Overdue')
                        ->icon('heroicon-o-exclamation-triangle')
                        ->color('danger')
                        ->action(function ($records) {
                            foreach ($records as $record) {
                                if (in_array($record->payment_status, ['pending']) && $record->due_date < now()) {
                                    $record->update([
                                        'payment_status' => 'overdue',
                                        'late_fee' => $record->calculateLateFee(),
                                    ]);
                                }
                            }
                            
                            Notification::make()
                                ->success()
                                ->title('Fees Updated')
                                ->body('Selected fees have been marked as overdue.')
                                ->send();
                        }),
                ]),
            ])
            ->defaultSort('due_date', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListEventFees::route('/'),
            'create' => Pages\CreateEventFee::route('/create'),
            'edit' => Pages\EditEventFee::route('/{record}/edit'),
        ];
    }

    public static function getEloquentQuery(): Builder
    {
        $query = parent::getEloquentQuery()
            ->withoutGlobalScopes([
                SoftDeletingScope::class,
            ]);
            
        // Always filter by academy, even for super admin if they have academy_id set
        $user = Auth::user();
        if ($user && $user->academy_id) {
            // Use whereHas for better performance and avoid ambiguous column issues
            $query->whereHas('event', function ($eventQuery) use ($user) {
                $eventQuery->where('academy_id', $user->academy_id);
            })
            ->whereHas('student', function ($studentQuery) use ($user) {
                $studentQuery->where('academy_id', $user->academy_id);
            });
        } elseif ($user && !$user->is_super_admin) {
            // If user has no academy_id and is not super admin, show no records
            $query->whereRaw('1 = 0');
        }
        
        return $query;
    }

    // Override permission methods to use correct permission names
    public static function canViewAny(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('view_event_fees');
    }

    public static function canCreate(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('create_event_fees');
    }

    public static function canEdit($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('edit_event_fees');
    }

    public static function canDelete($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('delete_event_fees');
    }
}
