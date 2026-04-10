<?php

namespace App\Filament\Student\Pages;

use Filament\Pages\Page;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use App\Models\Event;
use App\Models\EventParticipant;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Auth;

class Events extends Page implements HasTable
{
    use InteractsWithTable;

    protected static ?string $navigationIcon = 'heroicon-o-calendar-days';

    protected static string $view = 'filament.student.pages.events';

    protected static ?string $navigationLabel = 'Events';

    protected static ?string $navigationGroup = 'Academy Activities';

    protected static ?int $navigationSort = 3;

    public function table(Table $table): Table
    {
        return $table
            ->query(
                Event::query()
                    ->where('academy_id', Auth::guard('student')->user()->academy_id)
                    ->where('status', 'published')
                    ->with(['participants' => fn ($query) => $query->where('student_id', Auth::guard('student')->id())])
            )
            ->columns([
                Tables\Columns\ImageColumn::make('image')
                    ->square()
                    ->size(80),

                Tables\Columns\Layout\Stack::make([
                    Tables\Columns\TextColumn::make('title')
                        ->weight('bold')
                        ->size('lg'),
                    
                    Tables\Columns\TextColumn::make('description')
                        ->limit(100)
                        ->color('gray'),
                    
                    Tables\Columns\Layout\Split::make([
                        Tables\Columns\BadgeColumn::make('type')
                            ->colors([
                                'primary' => 'general',
                                'info' => 'training',
                                'warning' => 'competition',
                                'success' => 'workshop',
                                'danger' => 'grading',
                            ]),
                        
                        Tables\Columns\TextColumn::make('event_date')
                            ->dateTime('d M Y, H:i')
                            ->icon('heroicon-o-clock'),
                    ]),
                    
                    Tables\Columns\Layout\Split::make([
                        Tables\Columns\TextColumn::make('location')
                            ->icon('heroicon-o-map-pin')
                            ->color('gray')
                            ->visible(fn ($record) => $record && $record->location),
                        
                        Tables\Columns\TextColumn::make('fee')
                            ->money('INR')
                            ->icon('heroicon-o-currency-rupee')
                            ->color('warning')
                            ->visible(fn ($record) => $record && $record->fee > 0),
                    ]),
                ])
                ->space(2),

                Tables\Columns\Layout\Panel::make([
                    Tables\Columns\Layout\Split::make([
                        Tables\Columns\BadgeColumn::make('participants.status')
                            ->label('Your Response')
                            ->getStateUsing(function ($record) {
                                if (!$record) return 'not_invited';
                                $participant = $record->participants->first();
                                return $participant?->status ?? 'not_invited';
                            })
                            ->colors([
                                'warning' => 'invited',
                                'success' => 'interested',
                                'danger' => 'not_interested',
                                'info' => 'attended',
                                'gray' => 'not_invited',
                            ])
                            ->formatStateUsing(function ($state) {
                                return match ($state) {
                                    'invited' => 'Pending Response',
                                    'interested' => 'Interested',
                                    'not_interested' => 'Not Interested',
                                    'attended' => 'Attended',
                                    'not_invited' => 'Not Eligible',
                                    default => ucfirst($state)
                                };
                            }),
                    ])
                        ->from('md'),
                ])
                    ->collapsible(),
            ])
            ->contentGrid([
                'md' => 1,
                'lg' => 1,
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('type')
                    ->options([
                        'general' => 'General Event',
                        'training' => 'Training Session',
                        'competition' => 'Competition',
                        'workshop' => 'Workshop',
                        'seminar' => 'Seminar',
                        'grading' => 'Belt Grading',
                        'social' => 'Social Event',
                    ]),

                Tables\Filters\SelectFilter::make('my_response')
                    ->label('My Response')
                    ->options([
                        'invited' => 'Pending Response',
                        'interested' => 'Interested',
                        'not_interested' => 'Not Interested',
                        'attended' => 'Attended',
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        if ($data['value']) {
                            return $query->whereHas('participants', function (Builder $query) use ($data) {
                                $query->where('student_id', Auth::guard('student')->id())
                                    ->where('status', $data['value']);
                            });
                        }
                        return $query;
                    }),

                Tables\Filters\Filter::make('upcoming')
                    ->query(fn (Builder $query): Builder => $query->where('event_date', '>', now())),
            ])
            ->actions([
                Tables\Actions\Action::make('respond_interested')
                    ->label('I\'m Interested')
                    ->icon('heroicon-o-hand-thumb-up')
                    ->color('success')
                    ->visible(function ($record) {
                        if (!$record) return false;
                        $participant = $record->participants->first();
                        return $participant && 
                               $participant->status === 'invited' && 
                               $record->canRsvp();
                    })
                    ->form([
                        \Filament\Forms\Components\Textarea::make('notes')
                            ->label('Notes (Optional)')
                            ->placeholder('Any additional comments or questions...')
                            ->rows(3),
                    ])
                    ->action(function ($record, array $data) {
                        $participant = EventParticipant::where('event_id', $record->id)
                            ->where('student_id', Auth::guard('student')->id())
                            ->first();

                        if ($participant) {
                            $participant->markAsInterested($data['notes'] ?? null);

                            Notification::make()
                                ->success()
                                ->title('Response Recorded')
                                ->body('You have successfully registered your interest for this event.')
                                ->send();
                        }
                    }),

                Tables\Actions\Action::make('respond_not_interested')
                    ->label('Not Interested')
                    ->icon('heroicon-o-hand-thumb-down')
                    ->color('danger')
                    ->visible(function ($record) {
                        if (!$record) return false;
                        $participant = $record->participants->first();
                        return $participant && 
                               $participant->status === 'invited' && 
                               $record->canRsvp();
                    })
                    ->form([
                        \Filament\Forms\Components\Textarea::make('notes')
                            ->label('Reason (Optional)')
                            ->placeholder('Please let us know why you cannot attend...')
                            ->rows(3),
                    ])
                    ->action(function ($record, array $data) {
                        $participant = EventParticipant::where('event_id', $record->id)
                            ->where('student_id', Auth::guard('student')->id())
                            ->first();

                        if ($participant) {
                            $participant->markAsNotInterested($data['notes'] ?? null);

                            Notification::make()
                                ->warning()
                                ->title('Response Recorded')
                                ->body('Your response has been recorded. We hope to see you at future events!')
                                ->send();
                        }
                    }),

                Tables\Actions\Action::make('change_response')
                    ->label('Change Response')
                    ->icon('heroicon-o-arrow-path')
                    ->color('info')
                    ->visible(function ($record) {
                        if (!$record) return false;
                        $participant = $record->participants->first();
                        return $participant && 
                               in_array($participant->status, ['interested', 'not_interested']) && 
                               $record->canRsvp();
                    })
                    ->form([
                        \Filament\Forms\Components\Select::make('new_status')
                            ->label('New Response')
                            ->options([
                                'interested' => 'Interested',
                                'not_interested' => 'Not Interested',
                            ])
                            ->required(),
                        
                        \Filament\Forms\Components\Textarea::make('notes')
                            ->label('Notes (Optional)')
                            ->rows(3),
                    ])
                    ->action(function ($record, array $data) {
                        $participant = EventParticipant::where('event_id', $record->id)
                            ->where('student_id', Auth::guard('student')->id())
                            ->first();

                        if ($participant) {
                            if ($data['new_status'] === 'interested') {
                                $participant->markAsInterested($data['notes'] ?? null);
                            } else {
                                $participant->markAsNotInterested($data['notes'] ?? null);
                            }

                            Notification::make()
                                ->success()
                                ->title('Response Updated')
                                ->body('Your response has been updated successfully.')
                                ->send();
                        }
                    }),

                Tables\Actions\ViewAction::make()
                    ->label('View Details')
                    ->modalHeading(fn ($record) => $record->title)
                    ->modalContent(fn ($record) => view('filament.student.pages.event-details-modal', ['record' => $record])),
            ])
            ->emptyStateHeading('No Events Available')
            ->emptyStateDescription('There are currently no events published for your academy.')
            ->emptyStateIcon('heroicon-o-calendar-days')
            ->defaultSort('event_date', 'asc');
    }

    public function getTitle(): string
    {
        return 'Academy Events';
    }

    public function getHeading(): string
    {
        return 'Academy Events';
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('my_events')
                ->label('My Events')
                ->icon('heroicon-o-user-circle')
                ->color('info')
                ->action(function () {
                    // Filter to show only events the student has responded to
                    $this->table->filter('my_response', 'interested');
                }),
        ];
    }
}
