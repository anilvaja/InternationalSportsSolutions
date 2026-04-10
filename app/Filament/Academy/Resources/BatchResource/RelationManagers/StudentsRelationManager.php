<?php

namespace App\Filament\Academy\Resources\BatchResource\RelationManagers;

use App\Models\Student;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Actions\AttachAction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class StudentsRelationManager extends RelationManager
{
    protected static string $relationship = 'students';
    
    protected static ?string $recordTitleAttribute = 'first_name';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\DateTimePicker::make('joined_at')
                    ->label('Joined Date')
                    ->default(now())
                    ->required(),

                Forms\Components\Toggle::make('is_active')
                    ->label('Active')
                    ->default(true),

                Forms\Components\Textarea::make('notes')
                    ->label('Notes')
                    ->rows(3)
                    ->columnSpanFull(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('first_name')
            ->columns([
                Tables\Columns\TextColumn::make('student_id')
                    ->label('Student ID')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('first_name')
                    ->label('First Name')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('last_name')
                    ->label('Last Name')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('email')
                    ->label('Email')
                    ->searchable()
                    ->toggleable(),

                Tables\Columns\TextColumn::make('phone')
                    ->label('Contact Number')
                    ->searchable()
                    ->copyable()
                    ->weight('medium'),

                Tables\Columns\TextColumn::make('pivot.joined_at')
                    ->label('Joined Date')
                    ->dateTime()
                    ->sortable(),

                Tables\Columns\IconColumn::make('pivot.is_active')
                    ->label('Active')
                    ->boolean()
                    ->sortable(),

                Tables\Columns\TextColumn::make('pivot.left_at')
                    ->label('Left Date')
                    ->dateTime()
                    ->placeholder('Still active'),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active')
                    ->label('Active')
                    ->placeholder('All students')
                    ->trueLabel('Active students only')
                    ->falseLabel('Inactive students only')
                    ->queries(
                        true: fn (Builder $query) => $query->wherePivot('is_active', true),
                        false: fn (Builder $query) => $query->wherePivot('is_active', false),
                        blank: fn (Builder $query) => $query,
                    ),
            ])
            ->headerActions([
                Tables\Actions\AttachAction::make()
                    ->label(function () {
                        $batch = $this->ownerRecord;
                        if (!$batch->hasCapacity()) {
                            return 'Batch Full';
                        }
                        return 'Enroll Students';
                    })
                    ->multiple()
                    ->modalHeading(function () {
                        $batch = $this->ownerRecord;
                        $availableSlots = $batch->getAvailableSlots();
                        return "Enroll Students in Batch ({$availableSlots} slots available)";
                    })
                    ->modalDescription(function () {
                        $batch = $this->ownerRecord;
                        $currentCount = $batch->getCurrentStudentCount();
                        $maxStudents = $batch->max_students;
                        $availableSlots = $batch->getAvailableSlots();
                        
                        return "Current enrollment: {$currentCount}/{$maxStudents} students. Available slots: {$availableSlots}. Only students from the same branch ({$batch->branch->name}) who are not currently enrolled in any active batch will be available for selection.";
                    })
                    ->visible(function () {
                        $batch = $this->ownerRecord;
                        return $batch->hasCapacity();
                    })
                    ->disabled(function () {
                        $batch = $this->ownerRecord;
                        return !$batch->hasCapacity();
                    })
                    ->recordSelectOptionsQuery(function (Builder $query) {
                        $batch = $this->ownerRecord;
                        return $query->where('academy_id', $batch->academy_id)
                                   ->where('branch_id', $batch->branch_id)
                                   ->whereDoesntHave('batches', function ($query) {
                                       $query->where('batch_students.is_active', true);
                                   })
                                   ->orderBy('first_name')
                                   ->orderBy('last_name')
                                   ->limit(100);
                    })
                    ->form(fn (AttachAction $action): array => [
                        Forms\Components\Section::make('Enrollment Information')
                            ->description(function () {
                                $batch = $this->ownerRecord;
                                $currentCount = $batch->getCurrentStudentCount();
                                $maxStudents = $batch->max_students;
                                $availableSlots = $batch->getAvailableSlots();
                                
                                return "Current enrollment: {$currentCount}/{$maxStudents} students. You can select up to {$availableSlots} students from {$batch->branch->name} branch for enrollment.";
                            })
                            ->schema([
                                $action->getRecordSelect()
                                    ->label('Select Students to Enroll')
                                    ->multiple()
                                    ->searchable(['first_name', 'last_name', 'student_id', 'phone', 'email'])
                                    ->placeholder('Search by name, phone, student ID, or email...')
                                    ->helperText(function () {
                                        $batch = $this->ownerRecord;
                                        $availableSlots = $batch->getAvailableSlots();
                                        return "⚠️ Maximum {$availableSlots} students can be selected based on available capacity.";
                                    })
                                    ->getOptionLabelFromRecordUsing(fn (Student $record): string => 
                                        "{$record->first_name} {$record->last_name} - {$record->phone} ({$record->student_id})")
                                    ->getSearchResultsUsing(function (string $search) {
                                        $batch = $this->ownerRecord;
                                        return Student::where('academy_id', $batch->academy_id)
                                            ->where('branch_id', $batch->branch_id)
                                            ->whereDoesntHave('batches', function ($query) {
                                                $query->where('batch_students.is_active', true);
                                            })
                                            ->where(function ($query) use ($search) {
                                                $query->where('first_name', 'like', "%{$search}%")
                                                      ->orWhere('last_name', 'like', "%{$search}%")
                                                      ->orWhere('phone', 'like', "%{$search}%")
                                                      ->orWhere('student_id', 'like', "%{$search}%")
                                                      ->orWhere('email', 'like', "%{$search}%");
                                            })
                                            ->orderBy('first_name')
                                            ->orderBy('last_name')
                                            ->limit(50)
                                            ->get()
                                            ->mapWithKeys(function ($student) {
                                                return [$student->id => "{$student->first_name} {$student->last_name} - {$student->phone} ({$student->student_id})"];
                                            });
                                    })
                                    ->getOptionLabelsUsing(function (array $values): array {
                                        return Student::find($values)
                                            ->mapWithKeys(function ($student) {
                                                return [$student->id => "{$student->first_name} {$student->last_name} - {$student->phone} ({$student->student_id})"];
                                            })
                                            ->toArray();
                                    }),
                            ]),

                        Forms\Components\DateTimePicker::make('joined_at')
                            ->label('Joined Date')
                            ->default(now())
                            ->required(),

                        Forms\Components\Toggle::make('is_active')
                            ->label('Active')
                            ->default(true),

                        Forms\Components\Textarea::make('notes')
                            ->label('Notes')
                            ->rows(3),
                    ])
                    ->preloadRecordSelect()
                    ->action(function (AttachAction $action, array $data) {
                        $batch = $this->ownerRecord;
                        $studentIds = $data['recordId'];
                        
                        // Ensure $studentIds is always an array
                        if (!is_array($studentIds)) {
                            $studentIds = [$studentIds];
                        }
                        
                        // Check batch capacity
                        $currentCount = $batch->getCurrentStudentCount();
                        $maxStudents = $batch->max_students;
                        $studentsToEnroll = count($studentIds);
                        $availableSlots = $batch->getAvailableSlots();
                        
                        if ($studentsToEnroll > $availableSlots) {
                            \Filament\Notifications\Notification::make()
                                ->title('Enrollment Failed')
                                ->body("Cannot enroll {$studentsToEnroll} students. Only {$availableSlots} slots available (Current: {$currentCount}/{$maxStudents}).")
                                ->danger()
                                ->persistent()
                                ->send();
                            return;
                        }
                        
                        // Check if all selected students are from the same branch as the batch
                        $studentsFromDifferentBranch = Student::whereIn('id', $studentIds)
                            ->where('branch_id', '!=', $batch->branch_id)
                            ->get(['first_name', 'last_name', 'branch_id']);
                            
                        if ($studentsFromDifferentBranch->isNotEmpty()) {
                            $names = $studentsFromDifferentBranch->map(fn($s) => "{$s->first_name} {$s->last_name}")->join(', ');
                            \Filament\Notifications\Notification::make()
                                ->title('Enrollment Failed')
                                ->body("The following students are from different branches and cannot be enrolled in this batch: {$names}. Students must be from the same branch as the batch.")
                                ->danger()
                                ->persistent()
                                ->send();
                            return;
                        }
                        
                        // Check if any selected students are already enrolled in an active batch
                        $conflictingStudents = Student::whereIn('id', $studentIds)
                            ->whereHas('batches', function ($query) {
                                $query->where('batch_students.is_active', true);
                            })
                            ->get(['first_name', 'last_name']);
                            
                        if ($conflictingStudents->isNotEmpty()) {
                            $names = $conflictingStudents->map(fn($s) => "{$s->first_name} {$s->last_name}")->join(', ');
                            \Filament\Notifications\Notification::make()
                                ->title('Enrollment Failed')
                                ->body("The following students are already enrolled in an active batch: {$names}. A student can only be enrolled in one batch at a time.")
                                ->danger()
                                ->persistent()
                                ->send();
                            return;
                        }
                        
                        // Proceed with enrollment
                        foreach ($studentIds as $studentId) {
                            $batch->students()->attach($studentId, [
                                'joined_at' => $data['joined_at'] ?? now(),
                                'is_active' => $data['is_active'] ?? true,
                                'notes' => $data['notes'] ?? null,
                            ]);
                        }
                        
                        // Success notification
                        $enrolledCount = count($studentIds);
                        \Filament\Notifications\Notification::make()
                            ->title('Enrollment Successful')
                            ->body("Successfully enrolled {$enrolledCount} student(s) in the batch.")
                            ->success()
                            ->send();
                    }),

                Tables\Actions\Action::make('batch_capacity_info')
                    ->label(function () {
                        $batch = $this->ownerRecord;
                        $currentCount = $batch->getCurrentStudentCount();
                        $maxStudents = $batch->max_students;
                        return "Batch Full ({$currentCount}/{$maxStudents})";
                    })
                    ->icon('heroicon-o-information-circle')
                    ->color('warning')
                    ->visible(function () {
                        $batch = $this->ownerRecord;
                        return !$batch->hasCapacity();
                    })
                    ->action(function () {
                        // Do nothing, just show info
                    })
                    ->modalHeading('Batch Capacity Information')
                    ->modalDescription(function () {
                        $batch = $this->ownerRecord;
                        $currentCount = $batch->getCurrentStudentCount();
                        $maxStudents = $batch->max_students;
                        return "This batch is currently at full capacity with {$currentCount} out of {$maxStudents} students enrolled. To enroll new students, you'll need to either increase the batch capacity or wait for existing students to leave.";
                    })
                    ->modalSubmitAction(false)
                    ->modalCancelActionLabel('Close'),
            ])
            ->actions([
                Tables\Actions\EditAction::make()
                    ->form([
                        Forms\Components\DateTimePicker::make('joined_at')
                            ->label('Joined Date')
                            ->required(),

                        Forms\Components\DateTimePicker::make('left_at')
                            ->label('Left Date'),

                        Forms\Components\Toggle::make('is_active')
                            ->label('Active'),

                        Forms\Components\Textarea::make('notes')
                            ->label('Notes')
                            ->rows(3),
                    ]),

                Tables\Actions\DetachAction::make()
                    ->label('Remove from Batch'),

                Tables\Actions\Action::make('deactivate')
                    ->label('Mark as Left')
                    ->icon('heroicon-o-x-mark')
                    ->color('warning')
                    ->visible(fn ($record) => $record->pivot->is_active)
                    ->requiresConfirmation()
                    ->modalHeading('Mark student as left batch')
                    ->modalDescription('This will mark the student as having left the batch. Are you sure?')
                    ->action(function ($record) {
                        $record->pivot->update([
                            'is_active' => false,
                            'left_at' => now(),
                        ]);
                    }),

                Tables\Actions\Action::make('reactivate')
                    ->label('Reactivate')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->visible(fn ($record) => !$record->pivot->is_active)
                    ->requiresConfirmation()
                    ->action(function ($record) {
                        $record->pivot->update([
                            'is_active' => true,
                            'left_at' => null,
                        ]);
                    }),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DetachBulkAction::make()
                        ->label('Remove from Batch'),
                ]),
            ])
            ->defaultSort('first_name', 'asc');
    }
}
