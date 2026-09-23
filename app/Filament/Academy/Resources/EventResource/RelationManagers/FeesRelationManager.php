<?php

namespace App\Filament\Academy\Resources\EventResource\RelationManagers;

use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Filament\Tables\Actions\Action;
use Filament\Notifications\Notification;

class FeesRelationManager extends RelationManager
{
    protected static string $relationship = 'fees';
    protected static ?string $title = 'Event Fees';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('student_id')
                    ->relationship('student', 'first_name')
                    ->required()
                    ->searchable()
                    ->preload()
                    ->getOptionLabelFromRecordUsing(fn ($record) => "{$record->first_name} {$record->last_name} ({$record->student_id})"),
                
                Forms\Components\TextInput::make('amount')
                    ->required()
                    ->numeric()
                    ->prefix('₹')
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
                    ->default(function () {
                        return $this->getOwnerRecord()->fee ?? 0;
                    })
                    ->rules(['numeric', 'min:0']),
                
                Forms\Components\TextInput::make('discount_amount')
                    ->numeric()
                    ->prefix('₹')
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
                    ->prefix('₹')
                    ->step(0.01)
                    ->disabled()
                    ->dehydrated()
                    ->default(function () {
                        return $this->getOwnerRecord()->fee ?? 0;
                    })
                    ->helperText('Automatically calculated: Amount - Discount'),
                
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
                
                Forms\Components\DateTimePicker::make('due_date')
                    ->required()
                    ->default(function () {
                        $event = $this->getOwnerRecord();
                        return $event->event_date?->subDays(7);
                    }),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('student.first_name')
            ->columns([
                Tables\Columns\TextColumn::make('student.student_id')
                    ->label('Student ID')
                    ->searchable(),
                
                Tables\Columns\TextColumn::make('student.first_name')
                    ->label('Student Name')
                    ->formatStateUsing(fn ($record) => "{$record->student->first_name} {$record->student->last_name}")
                    ->searchable(['first_name', 'last_name']),
                
                Tables\Columns\TextColumn::make('amount')
                    ->label('Original Amount')
                    ->money('INR')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('final_amount')
                    ->label('Final Amount')
                    ->money('INR')
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
            ])
            ->headerActions([
                Tables\Actions\CreateAction::make(),
                
                Action::make('create_all_fees')
                    ->label('Create Fees for All Participants')
                    ->icon('heroicon-o-plus-circle')
                    ->color('success')
                    ->action(function () {
                        $event = $this->getOwnerRecord();
                        $createdCount = $event->createFeesForAllParticipants();
                        
                        Notification::make()
                            ->success()
                            ->title('Fees Created')
                            ->body("Fee records created for {$createdCount} participants.")
                            ->send();
                    })
                    ->requiresConfirmation()
                    ->visible(fn () => $this->getOwnerRecord()->fee > 0),
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
                
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }
}
