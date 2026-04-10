<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Student;
use App\Models\StudentAttendance;
use App\Models\BatchAttendance;
use App\Notifications\AbsenteeNotification;
use App\Support\AcademyPermissionHelper;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\BulkAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\BadgeColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Filament\Notifications\Notification;

class AbsenteeStudents extends BaseWidget
{
    protected static ?string $heading = "Students with Recent Absences";
    protected static ?int $sort = 3;
    protected int | string | array $columnSpan = 'full';
    protected static ?string $pollingInterval = '60s';
    
    // Store the actual consecutive absence counts for each student
    private array $studentAbsenceCounts = [];

    public static function canView(): bool
    {
        return AcademyPermissionHelper::can('view_students') && AcademyPermissionHelper::can('view_attendances');
    }

    public function table(Table $table): Table
    {
        // If the query approach fails, fall back to a simpler method
        try {
            return $table
                ->query($this->getAbsenteeStudentsQuery())
                ->columns($this->getColumns())
                ->actions($this->getActions())
                ->bulkActions($this->getBulkActions())
                ->emptyStateHeading('No Recent Absentees')
                ->emptyStateDescription('Great! No students have been absent in recent sessions.')
                ->emptyStateIcon('heroicon-o-check-circle');
        } catch (\Exception $e) {
            // Fallback: use a simple Student query
            return $table
                ->query(
                    Student::query()
                        ->where('academy_id', Auth::user()->academy_id)
                        ->where('status', 'active')
                        ->limit(0) // Show empty for now
                )
                ->columns($this->getColumns())
                ->emptyStateHeading('Query Error')
                ->emptyStateDescription('There was an issue loading absent students. Please check the logs.')
                ->emptyStateIcon('heroicon-o-exclamation-triangle');
        }
    }

    private function getColumns(): array
    {
        return [
            TextColumn::make('student_name')
                ->label('Student Name')
                ->searchable()
                ->weight('bold')
                ->getStateUsing(fn($record) => ($record->first_name ?? '') . ' ' . ($record->last_name ?? '')),
            
            TextColumn::make('student_code')
                ->label('Student ID')
                ->badge()
                ->color('primary')
                ->getStateUsing(fn($record) => $record->student_id ?? $record->student_code ?? 'N/A'),
            
            BadgeColumn::make('status')
                ->label('Status')
                ->colors([
                    'success' => 'active',
                    'warning' => 'suspended',
                    'danger' => 'inactive',
                ])
                ->default('active'),
            
            TextColumn::make('batch_name')
                ->label('Batch')
                ->searchable()
                ->default('N/A'),
            
            BadgeColumn::make('consecutive_absences')
                ->label('Recent Absences')
                ->colors([
                    'success' => 1,
                    'warning' => 2,
                    'danger' => fn($state) => $state >= 3,
                ])
                ->icon('heroicon-o-exclamation-triangle')
                ->getStateUsing(function($record) {
                    $count = $this->studentAbsenceCounts[$record->id] ?? 0;
                    // Debug log for Vihaan Modi specifically
                    if (($record->first_name ?? '') === 'Vihaan' && ($record->last_name ?? '') === 'Modi') {
                        Log::info("Vihaan Modi consecutive absences: {$count}", [
                            'student_id' => $record->id,
                            'stored_counts' => $this->studentAbsenceCounts
                        ]);
                    }
                    return $count;
                }),
            
            TextColumn::make('contact_number')
                ->label('Contact')
                ->getStateUsing(fn($record) => $record->phone ?: $record->parent_phone)
                ->icon('heroicon-o-phone'),
            
            TextColumn::make('parent_email')
                ->label('Email')
                ->icon('heroicon-o-envelope')
                ->limit(30),
        ];
    }

    private function getActions(): array
    {
        return [
            Action::make('send_notification')
                ->label('Send Notification')
                ->icon('heroicon-o-bell')
                ->color('warning')
                ->action(function($record) {
                    $this->sendAbsenteeNotification($record);
                }),
            
            Action::make('view_attendance')
                ->label('View Student')
                ->icon('heroicon-o-user')
                ->color('info')
                ->url(function($record) {
                    $studentId = $record->id ?? $record->student_id ?? null;
                    return $studentId ? route('filament.academy.resources.students.edit', $studentId) : '#';
                }),
        ];
    }

    private function getBulkActions(): array
    {
        return [
            BulkAction::make('send_bulk_notifications')
                ->label('Send Notifications')
                ->icon('heroicon-o-bell')
                ->color('warning')
                ->action(function(Collection $records) {
                    $sent = 0;
                    foreach($records as $record) {
                        $this->sendAbsenteeNotification($record);
                        $sent++;
                    }
                    
                    Notification::make()
                        ->title('Notifications Sent')
                        ->body("Successfully sent {$sent} absentee notifications.")
                        ->success()
                        ->send();
                }),
        ];
    }

    private function getAbsenteeStudentsQuery(): Builder
    {
        $academyId = Auth::user()->academy_id;
        
        // Simplified approach: Get students and filter in PHP for better SQLite compatibility
        $studentsWithConsecutiveAbsences = collect();
        
        // Get all students with attendance records
        $students = Student::where('academy_id', $academyId)
            ->whereIn('status', ['active', 'suspended'])
            ->with(['studentAttendances' => function($query) use ($academyId) {
                $query->join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                    ->where('batch_attendances.academy_id', $academyId)
                    ->orderBy('batch_attendances.class_date', 'desc')
                    ->select('student_attendances.*', 'batch_attendances.class_date')
                    ->limit(20); // Increased limit to check more attendance records for higher consecutive counts
            }])
            ->get();
        
        // Filter students with 3+ consecutive absences
        foreach ($students as $student) {
            $recentAttendances = $student->studentAttendances; // Get all recent attendance records, not just 3
            
            if ($recentAttendances->count() >= 3) {
                $consecutiveAbsences = 0;
                // Count ALL consecutive absences from the most recent records
                foreach ($recentAttendances as $attendance) {
                    if ($attendance->status === 'absent') {
                        $consecutiveAbsences++;
                    } else {
                        break; // Stop counting if not absent
                    }
                }
                
                if ($consecutiveAbsences >= 3) {
                    // Get batch name
                    $batchName = $student->batches()->where('batch_students.is_active', true)->first()->name ?? 'No Active Batch';
                    
                    // Create a pseudo-record for the table
                    $studentsWithConsecutiveAbsences->push((object)[
                        'id' => $student->id,
                        'student_id' => $student->id,
                        'first_name' => $student->first_name,
                        'last_name' => $student->last_name,
                        'student_code' => $student->student_id,
                        'status' => $student->status,
                        'phone' => $student->phone,
                        'parent_phone' => $student->parent_phone,
                        'parent_email' => $student->parent_email,
                        'batch_name' => $batchName,
                        'consecutive_absences' => $consecutiveAbsences,
                        'notification_sent' => 'No',
                        'student_name' => $student->first_name . ' ' . $student->last_name,
                    ]);
                }
            }
        }
        
        // Return a query builder that will return our filtered collection
        if ($studentsWithConsecutiveAbsences->isEmpty()) {
            // Return empty query
            return Student::query()->whereRaw('1 = 0');
        }
        
        // For simplicity, return students by IDs and let the table handle the display
        $studentIds = $studentsWithConsecutiveAbsences->pluck('id')->toArray();
        
        // Create a mapping of student IDs to their actual consecutive absence counts
        $this->studentAbsenceCounts = $studentsWithConsecutiveAbsences->pluck('consecutive_absences', 'id')->toArray();
        
        return Student::query()
            ->select([
                'students.id',
                'students.id as student_id',
                'students.first_name',
                'students.last_name', 
                'students.student_id as student_code',
                'students.status',
                'students.phone',
                'students.parent_phone',
                'students.parent_email',
                DB::raw('(
                    SELECT b.name 
                    FROM batch_students bs 
                    JOIN batches b ON bs.batch_id = b.id 
                    WHERE bs.student_id = students.id 
                    AND bs.is_active = 1 
                    LIMIT 1
                ) as batch_name'),
                DB::raw('"No" as notification_sent'),
                DB::raw('(students.first_name || " " || students.last_name) as student_name')
            ])
            ->whereIn('students.id', $studentIds)
            ->orderBy('students.first_name');
    }

    private function sendAbsenteeNotification($record): void
    {
        try {
            // Get the actual student ID
            $studentId = $record->id ?? $record->student_id ?? null;
            
            if (!$studentId) {
                throw new \Exception('Student ID not found in record');
            }
            
            $student = Student::find($studentId);
            
            if (!$student) {
                throw new \Exception('Student not found with ID: ' . $studentId);
            }
            
            $absenceCount = $this->studentAbsenceCounts[$studentId] ?? $record->consecutive_absences ?? 1;
            $batchName = $record->batch_name ?? 'Unknown Batch';
            
            $notification = new AbsenteeNotification($student, $batchName, $absenceCount);
            
            $student->notify($notification);
            
            Notification::make()
                ->title('Notification Sent')
                ->body("Absentee notification sent to {$student->first_name} {$student->last_name}'s parent/guardian.")
                ->success()
                ->send();
                
        } catch (\Exception $e) {
            Notification::make()
                ->title('Notification Failed')
                ->body("Failed to send notification: " . $e->getMessage())
                ->danger()
                ->send();
        }
    }
}
