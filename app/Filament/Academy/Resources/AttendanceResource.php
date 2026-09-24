<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\AttendanceResource\Pages;
use App\Models\BatchAttendance;
use App\Models\Batch;
use App\Models\Student;
use App\Models\StudentAttendance;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Illuminate\Database\Eloquent\Model;
use Filament\Forms\Components\Section;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Actions\Action;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Filament\Notifications\Notification;

class AttendanceResource extends BaseAcademyResource
{
    protected static ?string $model = BatchAttendance::class;

    protected static ?string $navigationIcon = 'heroicon-o-clipboard-document-check';
    
    protected static ?string $navigationLabel = 'Attendance';
    
    protected static ?string $modelLabel = 'Batch Attendance';
    
    protected static ?string $pluralModelLabel = 'Batch Attendances';

    protected static ?string $navigationGroup = 'Classes';

    protected static ?int $navigationSort = 1;



    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Hidden::make('academy_id')
                    ->default(fn () => Auth::user()->academy_id)
                    ->required(),
                    
                Section::make('Class Information')
                    ->schema([
                        Forms\Components\Select::make('batch_id')
                            ->label('Batch')
                            ->options(function () {
                                return Batch::where('academy_id', Auth::user()->academy_id)
                                    ->where('is_active', true)
                                    ->get()
                                    ->mapWithKeys(function ($batch) {
                                        return [$batch->id => $batch->name . ' - ' . $batch->code];
                                    });
                            })
                            ->required()
                            ->searchable()
                            ->reactive()
                            ->afterStateUpdated(function (callable $set, $state, callable $get) {
                                if ($state) {
                                    $batch = Batch::find($state);
                                    if ($batch) {
                                        // Get last attendance for this batch
                                        $lastAttendance = BatchAttendance::where('batch_id', $state)
                                            ->where('academy_id', Auth::user()->academy_id)
                                            ->where('status', '!=', 'cancelled')
                                            ->orderBy('class_date', 'desc')
                                            ->first();
                                        
                                        // Auto-calculate next attendance date based on last attendance and batch schedule
                                        $nextDate = self::calculateNextAttendanceDate($batch);
                                        $set('class_date', $nextDate);
                                        
                                        // Show information about last attendance and suggested date
                                        if ($lastAttendance) {
                                            $lastDateText = "Last attendance: " . $lastAttendance->class_date->format('M d, Y');
                                            
                                            // Check if we found a valid date based on schedule
                                            $nextDateObj = \Carbon\Carbon::parse($nextDate);
                                            $batchDays = [];
                                            if ($batch->weekdays) {
                                                $weekdays = array_map('trim', explode(',', strtolower($batch->weekdays)));
                                                $batchDays = array_map('ucfirst', $weekdays);
                                            }
                                            
                                            $scheduleText = !empty($batchDays) ? 
                                                " (Schedule: " . implode(', ', $batchDays) . ")" : 
                                                "";
                                            
                                            $isToday = $nextDateObj->isToday();
                                            $dateLabel = $isToday ? "Today" : "Suggested date";
                                            
                                            $notificationBody = "{$lastDateText}. {$dateLabel}: " . $nextDateObj->format('M d, Y (l)') . $scheduleText . ". Note: Future dates are not allowed for attendance.";
                                        } else {
                                            $nextDateObj = \Carbon\Carbon::parse($nextDate);
                                            $isToday = $nextDateObj->isToday();
                                            $dateLabel = $isToday ? "Today" : "Suggested date";
                                            
                                            $notificationBody = "No previous attendance found. {$dateLabel}: " . $nextDateObj->format('M d, Y (l)') . ". Note: Only today or past dates are allowed for attendance.";
                                        }
                                            
                                        \Filament\Notifications\Notification::make()
                                            ->title('Date Auto-calculated')
                                            ->body($notificationBody)
                                            ->info()
                                            ->duration(7000)
                                            ->send();
                                        
                                        // Auto-fill times from batch timing - ensure proper format for TimePicker
                                        $startTime = $batch->start_time instanceof \Carbon\Carbon ? 
                                            $batch->start_time->format('H:i') : 
                                            \Carbon\Carbon::parse($batch->start_time)->format('H:i');
                                            
                                        $endTime = $batch->end_time instanceof \Carbon\Carbon ? 
                                            $batch->end_time->format('H:i') : 
                                            \Carbon\Carbon::parse($batch->end_time)->format('H:i');
                                        
                                        $set('class_start_time', $startTime);
                                        $set('class_end_time', $endTime);
                                        
                                        // Show notification about auto-filled times
                                        \Filament\Notifications\Notification::make()
                                            ->title('Times Auto-filled')
                                            ->body("Start time set to {$startTime} and end time to {$endTime} from batch settings.")
                                            ->success()
                                            ->duration(4000)
                                            ->send();
                                        
                                        // Load students for attendance
                                        $students = $batch->activeStudents->map(function ($student) {
                                            return [
                                                'student_id' => $student->id,
                                                'academy_id' => Auth::user()->academy_id,
                                                'status' => 'present',
                                                'syllabus_technique_id' => \App\Models\SyllabusTechnique::getDefaultTechniqueIdForStudent((int) $student->id, (int) Auth::user()->academy_id),
                                            ];
                                        })->toArray();
                                        
                                        $set('studentAttendances', $students);
                                    }
                                } else {
                                    $set('studentAttendances', []);
                                }
                            }),

                        Forms\Components\DatePicker::make('class_date')
                            ->label('Class Date')
                            ->required()
                            ->maxDate(today()) // Disable future dates
                            ->helperText('Auto-calculated to skip existing attendance dates. Future dates are disabled - attendance can only be taken for today or past dates.')
                            ->reactive()
                            ->rules(['before_or_equal:today'])
                            ->afterStateUpdated(function (callable $get, callable $set, $state) {
                                $batchId = $get('batch_id');
                                if ($batchId && $state) {
                                    // Check if the selected date is in the future
                                    $selectedDate = \Carbon\Carbon::parse($state);
                                    $today = \Carbon\Carbon::today();
                                    
                                    if ($selectedDate->isAfter($today)) {
                                        \Filament\Notifications\Notification::make()
                                            ->title('Invalid Date')
                                            ->body('You cannot take attendance for future dates. Please select today or a past date.')
                                            ->danger()
                                            ->duration(6000)
                                            ->send();
                                        
                                        // Reset to today's date
                                        $set('class_date', today()->format('Y-m-d'));
                                        return;
                                    }
                                    
                                    // Check if attendance already exists for this batch and date
                                    $existingAttendance = BatchAttendance::where('batch_id', $batchId)
                                        ->where('class_date', $state)
                                        ->where('academy_id', Auth::user()->academy_id)
                                        ->first();
                                        
                                    if ($existingAttendance) {
                                        $existingDate = \Carbon\Carbon::parse($state)->format('M d, Y');
                                        \Filament\Notifications\Notification::make()
                                            ->title('Duplicate Attendance Warning')
                                            ->body("Attendance for this batch on {$existingDate} already exists (Record ID: {$existingAttendance->id}). Please choose a different date or edit the existing record.")
                                            ->warning()
                                            ->duration(8000)
                                            ->send();
                                    }
                                }
                            }),

                        Forms\Components\TimePicker::make('class_start_time')
                            ->label('Class Start Time')
                            ->required()
                            ->helperText('Auto-filled from batch timing when batch is selected')
                            ->reactive()
                            ->live()
                            ->seconds(false),

                        Forms\Components\TimePicker::make('class_end_time')
                            ->label('Class End Time') 
                            ->required()
                            ->helperText('Auto-filled from batch timing when batch is selected')
                            ->reactive()
                            ->live()
                            ->seconds(false)
                            ->rule(function (callable $get) {
                                return function (string $attribute, $value, \Closure $fail) use ($get) {
                                    $startTime = $get('class_start_time');
                                    if ($startTime && $value && $value <= $startTime) {
                                        $fail('End time must be after start time.');
                                    }
                                };
                            }),
                    ])
                    ->columns(2),

                Section::make('Class Status')
                    ->schema([
                        Forms\Components\Select::make('status')
                            ->options([
                                'scheduled' => 'Scheduled (Normal Class)',
                                'completed' => 'Completed',
                                'cancelled' => 'Cancelled',
                                'holiday' => 'Holiday/Off Day',
                            ])
                            ->default('scheduled')
                            ->required()
                            ->reactive(),

                        Forms\Components\Select::make('cancel_reason')
                            ->label('Reason for Cancellation/Holiday')
                            ->options([
                                'holiday' => 'Public Holiday',
                                'weather' => 'Bad Weather',
                                'facility_issue' => 'Facility Issue',
                                'coach_unavailable' => 'Coach Unavailable',
                                'emergency' => 'Emergency',
                                'academy_leave' => 'Academy Leave',
                                'festival' => 'Festival',
                                'other' => 'Other Reason',
                            ])
                            ->visible(fn (callable $get) => in_array($get('status'), ['cancelled', 'holiday']))
                            ->required(fn (callable $get) => in_array($get('status'), ['cancelled', 'holiday'])),

                        Forms\Components\Textarea::make('notes')
                            ->label('Notes')
                            ->rows(3)
                            ->placeholder('Any additional notes about the class status, topics covered, etc.')
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('Student Attendance')
                    ->schema([
                        Forms\Components\Repeater::make('studentAttendances')
                            ->label('')
                            ->relationship('studentAttendances')
                            ->schema([
                                Forms\Components\Hidden::make('student_id'),
                                Forms\Components\Hidden::make('academy_id')
                                    ->default(fn () => Auth::user()->academy_id),
                                
                                Forms\Components\Grid::make(3)
                                    ->schema([
                                        Forms\Components\Placeholder::make('student_name')
                                            ->label('Student')
                                            ->content(function ($state, $record, $get) {
                                                $studentId = $get('student_id');
                                                if ($studentId) {
                                                    $student = \App\Models\Student::find($studentId);
                                                    return $student ? $student->getSafeFullName() : 'Unknown Student';
                                                }
                                                return '';
                                            }),

                                        Forms\Components\Radio::make('status')
                                            ->label('Attendance Status')
                                            ->options([
                                                'present' => 'Present',
                                                'late' => 'Late',
                                                'absent' => 'Absent',
                                                'excused' => 'Excused',
                                                'medical_leave' => 'Medical Leave',
                                            ])
                                            ->default('present')
                                            ->required()
                                            ->inline()
                                            ->columns(2),

                                        Forms\Components\Select::make('syllabus_technique_id')
                                            ->label('Technique in Study')
                                            ->options(function ($get) {
                                                $studentId = $get('student_id');
                                                $academyId = Auth::user()->academy_id;
                                                $currentTechId = $get('syllabus_technique_id');
                                                if (!$studentId) return [];
                                                return \App\Models\SyllabusTechnique::getSelectableTechniquesForStudent((int) $studentId, (int) $academyId, $currentTechId ? (int) $currentTechId : null);
                                            })
                                            ->default(function ($get) {
                                                $studentId = $get('student_id');
                                                $academyId = Auth::user()->academy_id;
                                                if (!$studentId) return null;
                                                return \App\Models\SyllabusTechnique::getDefaultTechniqueIdForStudent((int) $studentId, (int) $academyId);
                                            })
                                            ->afterStateHydrated(function ($component, $state, $get) {
                                                if (blank($state)) {
                                                    $studentId = $get('student_id');
                                                    $academyId = Auth::user()?->academy_id;
                                                    if ($studentId && $academyId) {
                                                        $defaultId = \App\Models\SyllabusTechnique::getDefaultTechniqueIdForStudent((int) $studentId, (int) $academyId);
                                                        if ($defaultId) {
                                                            $component->state($defaultId);
                                                        }
                                                    }
                                                }
                                            })
                                            ->searchable()
                                            ->helperText('Defaults to current level. Coach can advance +1 level max or step back to any previous level.'),
                                    ]),
                            ])
                            ->visible(fn (callable $get) => !in_array($get('status'), ['cancelled', 'holiday']))
                            ->addable(false)
                            ->deletable(false)
                            ->reorderable(false)
                            ->defaultItems(function (callable $get) {
                                $batchId = $get('batch_id');
                                if (!$batchId) return [];
                                
                                $batch = \App\Models\Batch::find($batchId);
                                if (!$batch) return [];
                                
                                return $batch->activeStudents->map(function ($student) {
                                    return [
                                        'student_id' => $student->id,
                                        'academy_id' => Auth::user()->academy_id,
                                        'status' => 'present',
                                        'syllabus_technique_id' => \App\Models\SyllabusTechnique::getDefaultTechniqueIdForStudent((int) $student->id, (int) Auth::user()->academy_id),
                                    ];
                                })->toArray();
                            })
                            ->columns(1),
                    ])
                    ->visible(fn (callable $get) => $get('batch_id') && !in_array($get('status'), ['cancelled', 'holiday'])),

                Section::make('Make-up Class')
                    ->schema([
                        Forms\Components\Toggle::make('is_makeup_class')
                            ->label('This is a make-up class')
                            ->reactive(),

                        Forms\Components\Select::make('original_batch_attendance_id')
                            ->label('Original Class')
                            ->options(function () {
                                return BatchAttendance::where('academy_id', Auth::user()->academy_id)
                                    ->where('status', 'cancelled')
                                    ->with('batch')
                                    ->get()
                                    ->mapWithKeys(function ($attendance) {
                                        return [$attendance->id => $attendance->batch->name . ' - ' . $attendance->class_date->format('M d, Y')];
                                    });
                            })
                            ->searchable()
                            ->visible(fn (callable $get) => $get('is_makeup_class')),
                    ])
                    ->columns(2)
                    ->visible(false),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('batch.name')
                    ->label('Batch')
                    ->sortable()
                    ->searchable(),

                Tables\Columns\TextColumn::make('batch.code')
                    ->label('Code')
                    ->sortable(),

                Tables\Columns\TextColumn::make('class_date')
                    ->label('Date')
                    ->date('M d, Y')
                    ->sortable(),

                Tables\Columns\TextColumn::make('class_start_time')
                    ->label('Time')
                    ->formatStateUsing(fn ($record) => 
                        $record->class_start_time->format('H:i') . ' - ' . $record->class_end_time->format('H:i')
                    ),

                Tables\Columns\BadgeColumn::make('status')
                    ->colors([
                        'primary' => 'scheduled',
                        'success' => 'completed',
                        'danger' => 'cancelled',
                        'warning' => 'holiday',
                    ]),

                Tables\Columns\BooleanColumn::make('attendance_taken')
                    ->label('Attendance Taken')
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-x-circle'),

                Tables\Columns\TextColumn::make('studentAttendances')
                    ->label('Students')
                    ->formatStateUsing(function ($record) {
                        $total = $record->batch->activeStudents()->count();
                        $present = $record->studentAttendances()->whereIn('status', ['present', 'late'])->count();
                        return $record->attendance_taken ? "$present/$total" : "0/$total";
                    }),

                Tables\Columns\TextColumn::make('attendanceMarkedBy.name')
                    ->label('Marked By')
                    ->placeholder('—'),

                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('batch_id')
                    ->label('Batch')
                    ->options(function () {
                        $user = Auth::user();
                        $query = Batch::where('academy_id', $user->academy_id)->where('is_active', true);
                        
                        $myBatches = (clone $query)->where('coach_id', $user->id)->pluck('name', 'id');
                        if ($myBatches->isNotEmpty()) {
                            $otherBatches = (clone $query)->where(function($q) use ($user) {
                                $q->where('coach_id', '!=', $user->id)->orWhereNull('coach_id');
                            })->pluck('name', 'id');

                            $options = ['My Assigned Batches' => $myBatches->toArray()];
                            if ($otherBatches->isNotEmpty()) {
                                $options['Other Academy Batches'] = $otherBatches->toArray();
                            }
                            return $options;
                        }
                        return $query->pluck('name', 'id')->toArray();
                    }),

                SelectFilter::make('status')
                    ->options([
                        'scheduled' => 'Scheduled',
                        'completed' => 'Completed',
                        'cancelled' => 'Cancelled',
                        'holiday' => 'Holiday',
                    ]),

                Tables\Filters\Filter::make('attendance_taken')
                    ->query(fn (Builder $query): Builder => $query->where('attendance_taken', false))
                    ->label('Attendance Pending'),

                Tables\Filters\Filter::make('today')
                    ->query(fn (Builder $query): Builder => $query->whereDate('class_date', today()))
                    ->label('Today\'s Classes'),
            ])
            ->actions([
                Action::make('take_attendance')
                    ->label('Take Attendance')
                    ->icon('heroicon-o-clipboard-document-check')
                    ->color('success')
                    ->visible(fn ($record) => !$record->attendance_taken && $record->status === 'scheduled')
                    ->url(fn ($record) => route('filament.academy.resources.attendances.take-attendance', $record)),

                Tables\Actions\EditAction::make(),
                
                Action::make('view_attendance')
                    ->label('View Attendance')
                    ->icon('heroicon-o-eye')
                    ->color('info')
                    ->visible(fn ($record) => $record->attendance_taken)
                    ->url(fn ($record) => route('filament.academy.resources.attendances.view-attendance', $record)),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->defaultSort('class_date', 'desc');
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
            'index' => Pages\ListAttendances::route('/'),
            'create' => Pages\CreateAttendance::route('/create'),
            'edit' => Pages\EditAttendance::route('/{record}/edit'),
            'take-attendance' => Pages\TakeAttendance::route('/{record}/take-attendance'),
            'view-attendance' => Pages\ViewAttendance::route('/{record}/view-attendance'),
        ];
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where('academy_id', Auth::user()->academy_id);
    }

    public static function canCreate(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('create_attendances');
    }

    public static function canEdit($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('edit_attendances');
    }

    public static function canDelete($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('delete_attendances');
    }

    public static function canView($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('view_attendances');
    }

    protected static function calculateNextAttendanceDate(\App\Models\Batch $batch): string
    {
        // Get the last attendance date for this batch (excluding cancelled ones)
        $lastAttendance = BatchAttendance::where('batch_id', $batch->id)
            ->where('academy_id', Auth::user()->academy_id)
            ->where('status', '!=', 'cancelled')
            ->orderBy('class_date', 'desc')
            ->first();

        // If no previous attendance, start from today, otherwise start from day after last attendance
        // But never go beyond today (no future dates allowed for attendance)
        $searchStartDate = $lastAttendance ? 
            \Carbon\Carbon::parse($lastAttendance->class_date)->addDay() : 
            \Carbon\Carbon::today();
            
        // Ensure we don't search beyond today
        $today = \Carbon\Carbon::today();
        if ($searchStartDate->isAfter($today)) {
            $searchStartDate = $today;
        }

        // Parse batch weekdays (e.g., "Monday,Wednesday,Friday")
        if (!$batch->weekdays) {
            // If no weekdays specified, return the most recent valid date (today or before)
            $nextDate = $searchStartDate->copy();
            
            // Look backwards from start date to find a date without attendance
            for ($i = 0; $i < 30; $i++) {
                if ($nextDate->isAfter($today)) {
                    $nextDate = $today->copy();
                }
                
                $existingAttendance = BatchAttendance::where('batch_id', $batch->id)
                    ->where('academy_id', Auth::user()->academy_id)
                    ->where('class_date', $nextDate->format('Y-m-d'))
                    ->exists();
                    
                if (!$existingAttendance) {
                    return $nextDate->format('Y-m-d');
                }
                $nextDate->subDay();
                
                // Don't go too far back
                if ($nextDate->lt(\Carbon\Carbon::today()->subDays(60))) {
                    // Stop searching if too far in the past
                    return $today->format('Y-m-d');
                }
            }
            return $today->format('Y-m-d');
        }

        $batchWeekdays = array_map('trim', explode(',', strtolower($batch->weekdays)));
        
        // Map day names to Carbon constants (case insensitive)
        $dayMapping = [
            'monday' => \Carbon\Carbon::MONDAY,
            'tuesday' => \Carbon\Carbon::TUESDAY,
            'wednesday' => \Carbon\Carbon::WEDNESDAY,
            'thursday' => \Carbon\Carbon::THURSDAY,
            'friday' => \Carbon\Carbon::FRIDAY,
            'saturday' => \Carbon\Carbon::SATURDAY,
            'sunday' => \Carbon\Carbon::SUNDAY,
        ];

        // Convert batch weekdays to Carbon day numbers
        $batchDays = [];
        foreach ($batchWeekdays as $dayName) {
            $dayName = strtolower(trim($dayName));
            if (isset($dayMapping[$dayName])) {
                $batchDays[] = $dayMapping[$dayName];
            }
        }

        // If no valid days found, return today or most recent valid date
        if (empty($batchDays)) {
            $nextDate = $searchStartDate->copy();
            if ($nextDate->isAfter($today)) {
                $nextDate = $today->copy();
            }
            
            for ($i = 0; $i < 30; $i++) {
                $existingAttendance = BatchAttendance::where('batch_id', $batch->id)
                    ->where('academy_id', Auth::user()->academy_id)
                    ->where('class_date', $nextDate->format('Y-m-d'))
                    ->exists();
                    
                if (!$existingAttendance) {
                    return $nextDate->format('Y-m-d');
                }
                $nextDate->subDay();
                
                if ($nextDate->lt(\Carbon\Carbon::today()->subDays(60))) {
                    break;
                }
                    
                if (!$existingAttendance) {
                    return $nextDate->format('Y-m-d');
                }
            }
            $nextDate->subDay();
            
            // Don't go too far back
            if ($nextDate->lt(\Carbon\Carbon::today()->subDays(90))) {
                // Stop searching if too far in the past
                return $today->format('Y-m-d');
            }
        }

        // Ultimate fallback: return today if it matches batch schedule
        $today = \Carbon\Carbon::today();
        if (in_array($today->dayOfWeek, $batchDays)) {
            return $today->format('Y-m-d');
        }
        
        // If today doesn't match, find the most recent batch day
        $fallbackDate = $today->copy();
        for ($i = 0; $i < 7; $i++) {
            if (in_array($fallbackDate->dayOfWeek, $batchDays)) {
                return $fallbackDate->format('Y-m-d');
            }
            $fallbackDate->subDay();
        }
        
        // Final fallback: just return today
        return $today->format('Y-m-d');
    }
    
    /**
     * Override the permission name generation to match our database permissions
     */
    public static function getAcademyPermissionName(string $action): string
    {
        return $action . '_attendances';
    }
    
    public static function canViewAny(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('view_attendances');
    }
}
