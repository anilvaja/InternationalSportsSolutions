<?php

namespace App\Filament\Academy\Resources\EventResource\Pages;

use App\Filament\Academy\Resources\EventResource;
use App\Models\EventParticipant;
use Filament\Resources\Pages\Page;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use Filament\Notifications\Notification;

class EventParticipants extends Page implements HasTable
{
    use InteractsWithTable;

    protected static string $resource = EventResource::class;

    protected static string $view = 'filament.academy.resources.event-resource.pages.event-participants';

    public $record;

    public function mount($record): void
    {
        $this->record = $this->getResource()::resolveRecordRouteBinding($record);
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(
                EventParticipant::query()
                    ->where('event_id', $this->record->id)
                    ->with(['student'])
            )
            ->columns([
                Tables\Columns\TextColumn::make('student.student_id')->label('Student ID')->searchable(),
                Tables\Columns\TextColumn::make('student.first_name')->label('First Name')->searchable(),
                Tables\Columns\TextColumn::make('student.last_name')->label('Last Name')->searchable(),
                Tables\Columns\TextColumn::make('student.email')->label('Email')->searchable(),
                Tables\Columns\TextColumn::make('student.phone')->label('Phone')->searchable(),
                Tables\Columns\BadgeColumn::make('status')->colors([
                    'warning' => 'invited',
                    'success' => 'interested',
                    'danger' => 'not_interested',
                    'info' => 'attended',
                    'dark' => 'no_show',
                ]),
                Tables\Columns\TextColumn::make('student.eventFees.final_amount')
                    ->label('Fee Amount')
                    ->money('INR')
                    ->visible(fn () => $this->record->fee > 0)
                    ->getStateUsing(function ($record) {
                        return $record->student->eventFees()
                            ->where('event_id', $this->record->id)
                            ->first()?->final_amount ?? $this->record->fee;
                    }),
                Tables\Columns\BadgeColumn::make('fee_status')
                    ->label('Payment Status')
                    ->visible(fn () => $this->record->fee > 0)
                    ->getStateUsing(function ($record) {
                        return $record->student->eventFees()
                            ->where('event_id', $this->record->id)
                            ->first()?->payment_status ?? 'pending';
                    })
                    ->colors([
                        'warning' => 'pending',
                        'success' => 'paid',
                        'info' => 'partial',
                        'danger' => 'overdue',
                        'dark' => 'refunded',
                        'gray' => 'cancelled',
                    ]),
                Tables\Columns\TextColumn::make('responded_at')->label('Response Time')->dateTime('d M Y, H:i')->sortable(),
                Tables\Columns\TextColumn::make('response_notes')->label('Notes')->limit(50),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'invited' => 'Invited',
                        'interested' => 'Interested',
                        'not_interested' => 'Not Interested',
                        'attended' => 'Attended',
                        'no_show' => 'No Show',
                    ]),
            ])
            ->headerActions([
                Tables\Actions\Action::make('print')
                    ->label('Print List')
                    ->icon('heroicon-o-printer')
                    ->color('info')
                    ->url(fn () => route('academy.events.participants.print', $this->record->id))
                    ->openUrlInNewTab(),
            ]);
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('print')
                ->label('Print Participants')
                ->icon('heroicon-o-printer')
                ->color('info')
                ->url(fn () => route('academy.events.participants.print', $this->record->id))
                ->openUrlInNewTab(),
                
            Action::make('back')
                ->label('Back to Events')
                ->url($this->getResource()::getUrl('index'))
                ->color('gray')
                ->icon('heroicon-o-arrow-left'),
        ];
    }

    public function getTitle(): string
    {
        return "Participants - {$this->record->title}";
    }
}
