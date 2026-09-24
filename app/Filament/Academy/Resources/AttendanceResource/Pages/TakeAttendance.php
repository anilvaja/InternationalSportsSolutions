<?php

namespace App\Filament\Academy\Resources\AttendanceResource\Pages;

use App\Filament\Academy\Resources\AttendanceResource;
use App\Models\BatchAttendance;
use App\Models\StudentAttendance;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Form;
use Filament\Resources\Pages\Page;
use Filament\Actions\Action;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;
use Illuminate\Database\Eloquent\Model;

class TakeAttendance extends Page
{
    protected static string $resource = AttendanceResource::class;

    protected static string $view = 'filament.academy.resources.attendance-resource.pages.take-attendance';

    public BatchAttendance $record;

    public array $data = [];

    public function mount(BatchAttendance $record): void
    {
        $this->record = $record;
        
        // Initialize data with students
        $students = $record->batch->activeStudents;
        $existingAttendance = $record->studentAttendances()->with('student')->get()->keyBy('student_id');
        
        $studentData = [];
        foreach ($students as $student) {
            $attendance = $existingAttendance->get($student->id);
            $studentData[] = [
                'student_id' => $student->id,
                'student_name' => $student->first_name . ' ' . $student->last_name,
                'status' => $attendance?->status ?? 'present',
                'syllabus_technique_id' => $attendance?->syllabus_technique_id ?? \App\Models\SyllabusTechnique::getDefaultTechniqueIdForStudent((int) $student->id, (int) Auth::user()->academy_id),
                'actual_arrival_time' => $attendance?->actual_arrival_time ?? $record->class_start_time,
                'participation_level' => $attendance?->participation_level,
                'progress_notes' => $attendance?->progress_notes,
                'notes' => $attendance?->notes,
            ];
        }

        $this->data = [
            'students' => $studentData,
            'class_notes' => $record->notes,
        ];
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Class Information')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                TextInput::make('batch_name')
                                    ->label('Batch')
                                    ->default($this->record->batch->name . ' - ' . $this->record->batch->code)
                                    ->disabled(),

                                TextInput::make('class_date')
                                    ->label('Date')
                                    ->default($this->record->class_date->format('M d, Y'))
                                    ->disabled(),

                                TextInput::make('class_time')
                                    ->label('Time')
                                    ->default($this->record->class_start_time->format('H:i') . ' - ' . $this->record->class_end_time->format('H:i'))
                                    ->disabled(),
                            ]),
                    ]),

                Section::make('Student Attendance')
                    ->schema([
                        Repeater::make('students')
                            ->schema([
                                Grid::make(6)
                                    ->schema([
                                        TextInput::make('student_name')
                                            ->label('Student')
                                            ->disabled()
                                            ->columnSpan(1),

                                        Select::make('status')
                                            ->label('Status')
                                            ->options([
                                                'present' => 'Present',
                                                'absent' => 'Absent',
                                                'late' => 'Late',
                                                'excused' => 'Excused',
                                                'medical_leave' => 'Medical Leave',
                                            ])
                                            ->default('present')
                                            ->reactive()
                                            ->columnSpan(1),

                                        Select::make('syllabus_technique_id')
                                            ->label('Technique in Study')
                                            ->options(function ($get) {
                                                $studentId = $get('student_id');
                                                $academyId = Auth::user()->academy_id;
                                                $currentTechId = $get('syllabus_technique_id');
                                                if (!$studentId) return [];
                                                return \App\Models\SyllabusTechnique::getSelectableTechniquesForStudent((int) $studentId, (int) $academyId, $currentTechId ? (int) $currentTechId : null);
                                            })
                                            ->searchable()
                                            ->columnSpan(2),

                                        TimePicker::make('actual_arrival_time')
                                            ->label('Arrival Time')
                                            ->visible(fn (callable $get) => in_array($get('status'), ['present', 'late']))
                                            ->columnSpan(1),

                                        Select::make('participation_level')
                                            ->label('Participation')
                                            ->options([
                                                1 => '1 - Poor',
                                                2 => '2 - Below Average',
                                                3 => '3 - Average',
                                                4 => '4 - Good',
                                                5 => '5 - Excellent',
                                            ])
                                            ->visible(fn (callable $get) => in_array($get('status'), ['present', 'late']))
                                            ->columnSpan(1),
                                    ]),
                            ])
                            ->reorderable(false)
                            ->addable(false)
                            ->deletable(false)
                            ->defaultItems(count($this->data['students'])),
                    ]),

                Section::make('Class Notes')
                    ->schema([
                        Textarea::make('class_notes')
                            ->label('Overall Class Notes')
                            ->rows(3),
                    ]),
            ])
            ->statePath('data');
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('save_attendance')
                ->label('Save Attendance')
                ->icon('heroicon-o-check')
                ->color('success')
                ->action('saveAttendance'),

            Action::make('cancel')
                ->label('Cancel')
                ->color('gray')
                ->url($this->getResource()::getUrl('index')),
        ];
    }

    public function saveAttendance(): void
    {
        $data = $this->form->getState();

        try {
            // Save each student's attendance
            foreach ($data['students'] as $studentData) {
                StudentAttendance::updateOrCreate(
                    [
                        'batch_attendance_id' => $this->record->id,
                        'student_id' => $studentData['student_id'],
                    ],
                    [
                        'academy_id' => Auth::user()->academy_id,
                        'status' => $studentData['status'],
                        'syllabus_technique_id' => $studentData['syllabus_technique_id'] ?? null,
                        'actual_arrival_time' => $studentData['actual_arrival_time'] ?? null,
                        'participation_level' => $studentData['participation_level'] ?? null,
                        'progress_notes' => $studentData['progress_notes'] ?? null,
                        'notes' => $studentData['notes'] ?? null,
                    ]
                );
            }

            // Mark attendance as taken
            $this->record->update([
                'attendance_taken' => true,
                'attendance_marked_by' => Auth::id(),
                'attendance_marked_at' => now(),
                'status' => 'completed',
                'notes' => $data['class_notes'],
            ]);

            Notification::make()
                ->title('Attendance saved successfully!')
                ->success()
                ->send();

            $this->redirect($this->getResource()::getUrl('index'));
            
        } catch (\Exception $e) {
            Notification::make()
                ->title('Error saving attendance')
                ->body('Please try again. ' . $e->getMessage())
                ->danger()
                ->send();
        }
    }

    public function getTitle(): string
    {
        return 'Take Attendance - ' . $this->record->batch->name;
    }
}
