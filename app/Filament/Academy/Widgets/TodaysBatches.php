<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Batch;
use App\Models\BatchAttendance;
use App\Support\AcademyPermissionHelper;
use Filament\Tables\Actions\Action;
use Filament\Tables\Columns\BadgeColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

class TodaysBatches extends BaseWidget
{
    protected static ?string $heading = "Today's Batch Schedule";
    protected static ?int $sort = 2;
    protected int | string | array $columnSpan = 'full';
    protected static ?string $pollingInterval = '30s';

    public static function canView(): bool
    {
        return AcademyPermissionHelper::can('view_batches');
    }

    public function table(Table $table): Table
    {
        $todayDayName = strtolower(now()->format('l')); // e.g., 'monday', 'tuesday'
        
        return $table
            ->query(
                Batch::query()
                    ->where('academy_id', Auth::user()->academy_id)
                    ->where('is_active', true)
                    ->whereJsonContains('days_of_week', $todayDayName)
                    ->with(['coach', 'activeStudents', 'batchAttendances' => function($query) {
                        $query->whereDate('class_date', today());
                    }])
                    ->orderBy('start_time')
            )
            ->columns([
                TextColumn::make('name')
                    ->label('Batch Name')
                    ->searchable()
                    ->weight('bold'),
                
                TextColumn::make('batch_code')
                    ->label('Code')
                    ->badge()
                    ->color('primary'),
                
                TextColumn::make('time_slot')
                    ->label('Time')
                    ->getStateUsing(fn($record) => $record->getTimeSlot())
                    ->icon('heroicon-o-clock'),
                
                TextColumn::make('coach.name')
                    ->label('Coach')
                    ->default('Not Assigned')
                    ->icon('heroicon-o-user'),
                
                TextColumn::make('student_count')
                    ->label('Students')
                    ->getStateUsing(fn($record) => $record->activeStudents->count() . '/' . $record->max_students)
                    ->icon('heroicon-o-users'),
                
                BadgeColumn::make('attendance_status')
                    ->label('Attendance')
                    ->getStateUsing(function($record) {
                        $todayAttendance = $record->batchAttendances->first();
                        if (!$todayAttendance) {
                            return 'Not Scheduled';
                        }
                        if ($todayAttendance->attendance_taken) {
                            return 'Completed';
                        }
                        if ($todayAttendance->status === 'cancelled') {
                            return 'Cancelled';
                        }
                        return 'Pending';
                    })
                    ->colors([
                        'success' => 'Completed',
                        'danger' => 'Cancelled',
                        'warning' => 'Pending',
                        'gray' => 'Not Scheduled',
                    ])
                    ->icons([
                        'heroicon-o-check-circle' => 'Completed',
                        'heroicon-o-x-circle' => 'Cancelled',
                        'heroicon-o-clock' => 'Pending',
                        'heroicon-o-question-mark-circle' => 'Not Scheduled',
                    ]),
                
                TextColumn::make('room_location')
                    ->label('Location')
                    ->default('Not Set')
                    ->icon('heroicon-o-map-pin'),
            ])
            ->actions([
                Action::make('take_attendance')
                    ->label('Take Attendance')
                    ->icon('heroicon-o-clipboard-document-check')
                    ->color('success')
                    ->visible(function($record) {
                        if (!AcademyPermissionHelper::can('edit_attendances')) {
                            return false;
                        }
                        $todayAttendance = $record->batchAttendances->first();
                        return $todayAttendance && !$todayAttendance->attendance_taken && $todayAttendance->status !== 'cancelled';
                    })
                    ->url(function($record) {
                        $todayAttendance = $record->batchAttendances->first();
                        return $todayAttendance ? 
                            route('filament.academy.resources.attendances.edit', $todayAttendance) : 
                            null;
                    }),
                
                Action::make('view_students')
                    ->label('View Students')
                    ->icon('heroicon-o-users')
                    ->color('info')
                    ->visible(fn() => AcademyPermissionHelper::can('view_students'))
                    ->url(fn($record) => route('filament.academy.resources.batches.view', $record)),
                    
                Action::make('schedule_class')
                    ->label('Schedule Today')
                    ->icon('heroicon-o-plus-circle')
                    ->color('warning')
                    ->visible(function($record) {
                        if (!AcademyPermissionHelper::can('create_attendances')) {
                            return false;
                        }
                        return !$record->batchAttendances->first();
                    })
                    ->action(function($record) {
                        BatchAttendance::create([
                            'academy_id' => $record->academy_id,
                            'batch_id' => $record->id,
                            'class_date' => today(),
                            'class_start_time' => $record->start_time,
                            'class_end_time' => $record->end_time,
                            'status' => 'scheduled',
                        ]);
                        
                        $this->dispatch('refresh');
                    }),
            ])
            ->emptyStateHeading('No Batches Scheduled Today')
            ->emptyStateDescription('No batches are scheduled for today (' . now()->format('l, F j, Y') . ')')
            ->emptyStateIcon('heroicon-o-calendar-days');
    }
}
