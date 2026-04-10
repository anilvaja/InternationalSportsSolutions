<?php

namespace App\Filament\Academy\Resources\AttendanceResource\Pages;

use App\Filament\Academy\Resources\AttendanceResource;
use App\Models\BatchAttendance;
use Filament\Resources\Pages\Page;
use Filament\Actions\Action;
use Filament\Infolists\Infolist;
use Filament\Infolists\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\Grid;
use Filament\Infolists\Components\RepeatableEntry;

class ViewAttendance extends Page
{
    protected static string $resource = AttendanceResource::class;

    protected static string $view = 'filament.academy.resources.attendance-resource.pages.view-attendance';

    public BatchAttendance $record;

    public function mount(BatchAttendance $record): void
    {
        $this->record = $record->load(['batch', 'studentAttendances.student', 'attendanceMarkedBy']);
    }

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->record($this->record)
            ->schema([
                Section::make('Class Information')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                TextEntry::make('batch.name')
                                    ->label('Batch'),
                                
                                TextEntry::make('class_date')
                                    ->label('Date')
                                    ->date('M d, Y'),
                                
                                TextEntry::make('class_time')
                                    ->label('Time')
                                    ->formatStateUsing(fn ($record) => 
                                        $record->class_start_time->format('H:i') . ' - ' . $record->class_end_time->format('H:i')
                                    ),
                            ]),

                        Grid::make(2)
                            ->schema([
                                TextEntry::make('attendanceMarkedBy.name')
                                    ->label('Marked By'),
                                
                                TextEntry::make('attendance_marked_at')
                                    ->label('Marked At')
                                    ->dateTime(),
                            ]),

                        TextEntry::make('notes')
                            ->label('Class Notes')
                            ->placeholder('No notes')
                            ->columnSpanFull(),
                    ]),

                Section::make('Attendance Summary')
                    ->schema([
                        Grid::make(4)
                            ->schema([
                                TextEntry::make('total_students')
                                    ->label('Total Students')
                                    ->formatStateUsing(fn ($record) => $record->batch->activeStudents()->count()),
                                
                                TextEntry::make('present_students')
                                    ->label('Present')
                                    ->formatStateUsing(fn ($record) => 
                                        $record->studentAttendances()->where('status', 'present')->count()
                                    )
                                    ->color('success'),
                                
                                TextEntry::make('absent_students')
                                    ->label('Absent')
                                    ->formatStateUsing(fn ($record) => 
                                        $record->studentAttendances()->where('status', 'absent')->count()
                                    )
                                    ->color('danger'),
                                
                                TextEntry::make('attendance_rate')
                                    ->label('Attendance Rate')
                                    ->formatStateUsing(function ($record) {
                                        $total = $record->batch->activeStudents()->count();
                                        $present = $record->studentAttendances()->where('status', 'present')->count();
                                        return $total > 0 ? round(($present / $total) * 100, 1) . '%' : '0%';
                                    })
                                    ->color('primary'),
                            ]),
                    ]),

                Section::make('Student Details')
                    ->schema([
                        RepeatableEntry::make('studentAttendances')
                            ->label('')
                            ->schema([
                                Grid::make(4)
                                    ->schema([
                                        TextEntry::make('student.first_name')
                                            ->label('Student')
                                            ->formatStateUsing(fn ($record) => $record->student?->getSafeFullName() ?? 'Unknown Student'),
                                        
                                        TextEntry::make('status')
                                            ->label('Status')
                                            ->badge()
                                            ->color(fn (string $state): string => match ($state) {
                                                'present' => 'success',
                                                'absent' => 'danger',
                                                default => 'gray',
                                            }),
                                        
                                        TextEntry::make('actual_arrival_time')
                                            ->label('Arrival Time')
                                            ->time('H:i')
                                            ->placeholder('—'),
                                        
                                        TextEntry::make('notes')
                                            ->label('Notes')
                                            ->placeholder('—')
                                            ->lineClamp(null),
                                    ]),
                            ])
                            ->contained(false),
                    ]),
            ]);
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('edit_attendance')
                ->label('Edit Attendance')
                ->icon('heroicon-o-pencil')
                ->color('warning')
                ->url(fn () => $this->getResource()::getUrl('take-attendance', ['record' => $this->record])),

            Action::make('back')
                ->label('Back to List')
                ->color('gray')
                ->url($this->getResource()::getUrl('index')),
        ];
    }

    public function getTitle(): string
    {
        return 'View Attendance - ' . $this->record->batch->name . ' (' . $this->record->class_date->format('M d, Y') . ')';
    }
}
