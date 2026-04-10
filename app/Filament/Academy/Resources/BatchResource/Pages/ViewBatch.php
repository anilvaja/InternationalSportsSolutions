<?php

namespace App\Filament\Academy\Resources\BatchResource\Pages;

use App\Filament\Academy\Resources\BatchResource;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;
use Filament\Infolists\Infolist;
use Filament\Infolists\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\Grid;

class ViewBatch extends ViewRecord
{
    protected static string $resource = BatchResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\EditAction::make(),
            Actions\DeleteAction::make(),
        ];
    }

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->schema([
                Section::make('Batch Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('name'),
                                TextEntry::make('batch_code')
                                    ->label('Code'),
                                TextEntry::make('status')
                                    ->badge()
                                    ->color(fn (string $state): string => match ($state) {
                                        'active' => 'success',
                                        'inactive' => 'danger',
                                        'completed' => 'warning',
                                        default => 'gray',
                                    }),
                                TextEntry::make('max_students')
                                    ->label('Maximum Students'),
                            ]),
                    ]),
                
                Section::make('Schedule Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('start_date')
                                    ->date(),
                                TextEntry::make('end_date')
                                    ->date(),
                                TextEntry::make('start_time')
                                    ->time(),
                                TextEntry::make('end_time')
                                    ->time(),
                                TextEntry::make('days_of_week')
                                    ->formatStateUsing(fn ($state) => is_array($state) ? implode(', ', $state) : $state),
                            ]),
                    ]),

                Section::make('Location & Assignment')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextEntry::make('academy.name')
                                    ->label('Academy'),
                                TextEntry::make('branch.name')
                                    ->label('Branch'),
                                TextEntry::make('coach.name')
                                    ->label('Coach')
                                    ->placeholder('No coach assigned'),
                                TextEntry::make('room_location')
                                    ->label('Room/Location'),
                            ]),
                    ]),

                Section::make('Additional Information')
                    ->schema([
                        TextEntry::make('description')
                            ->columnSpanFull(),
                        TextEntry::make('notes')
                            ->columnSpanFull(),
                    ]),

                Section::make('Statistics')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                TextEntry::make('current_students_count')
                                    ->label('Current Students')
                                    ->getStateUsing(fn ($record) => $record->students()->wherePivot('is_active', true)->count()),
                                TextEntry::make('available_spots')
                                    ->label('Available Spots')
                                    ->getStateUsing(fn ($record) => max(0, $record->max_students - $record->students()->wherePivot('is_active', true)->count())),
                                TextEntry::make('capacity_percentage')
                                    ->label('Capacity %')
                                    ->getStateUsing(fn ($record) => round(($record->students()->wherePivot('is_active', true)->count() / $record->max_students) * 100, 1) . '%'),
                            ]),
                    ]),
            ]);
    }
}
