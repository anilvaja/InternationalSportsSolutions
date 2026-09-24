<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\BatchResource\Pages;
use App\Filament\Academy\Resources\BatchResource\RelationManagers;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\User;
use App\Models\SyllabusCategory;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Support\Enums\FontWeight;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

class BatchResource extends BaseAcademyResource
{
    protected static ?string $model = Batch::class;

    protected static ?string $navigationIcon = 'heroicon-o-user-group';

    protected static ?string $navigationLabel = 'Batches';

    protected static ?string $modelLabel = 'Batch';

    protected static ?string $pluralModelLabel = 'Batches';

    protected static ?string $navigationGroup = 'ACADEMY';

    protected static ?int $navigationSort = 2;



    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();
        
        return parent::getEloquentQuery()
            ->where('academy_id', $user->academy_id)
            ->with(['branch', 'coach', 'activeStudents']);
    }

    public static function form(Form $form): Form
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return $form
            ->schema([
                Forms\Components\Section::make('Basic Information')
                    ->schema([
                        Forms\Components\Grid::make(2)->schema([
                            Forms\Components\TextInput::make('name')
                                ->required()
                                ->maxLength(255)
                                ->placeholder('e.g., Kids Karate - Morning')
                                ->helperText('Enter a descriptive name for the batch')
                                ->validationMessages([
                                    'required' => 'Batch name is required.',
                                    'max' => 'Batch name cannot exceed 255 characters.',
                                ]),

                            Forms\Components\TextInput::make('batch_code')
                                ->label('Batch Code')
                                ->maxLength(50)
                                ->placeholder('e.g., MB-001')
                                ->helperText('Unique identifier for the batch')
                                ->required()
                                ->validationMessages([
                                    'required' => 'Batch code is required.',
                                    'max' => 'Batch code cannot exceed 50 characters.',
                                ]),
                        ]),

                        Forms\Components\Select::make('branch_id')
                            ->label('Branch')
                            ->options(function () use ($academyId) {
                                if (!$academyId) {
                                    return ['error' => 'No academy selected'];
                                }
                                
                                $branches = Branch::where('academy_id', $academyId)
                                    ->where('status', 'active')
                                    ->get();
                                
                                if ($branches->isEmpty()) {
                                    return ['no_branches' => 'No branches available'];
                                }
                                
                                return $branches->pluck('name', 'id')->toArray();
                            })
                            ->required()
                            ->searchable()
                            ->preload()
                            ->helperText('Select the branch where this batch will be conducted')
                            ->validationMessages([
                                'required' => 'Please select a branch for this batch.',
                            ]),

                        Forms\Components\Textarea::make('description')
                            ->maxLength(500)
                            ->rows(3)
                            ->placeholder('Brief description of the batch, its focus, and objectives'),

                        Forms\Components\Grid::make(3)->schema([
                            Forms\Components\Select::make('skill_level')
                                ->label('Skill Level')
                                ->options([
                                    'beginner' => 'Beginner',
                                    'intermediate' => 'Intermediate',
                                    'advanced' => 'Advanced',
                                    'mixed' => 'Mixed Level',
                                ])
                                ->required()
                                ->helperText('This field is required')
                                ->validationMessages([
                                    'required' => 'Please select a skill level for this batch.',
                                ]),

                            Forms\Components\Select::make('age_group')
                                ->label('Age Group')
                                ->options([
                                    'Kids (4-7 years)' => 'Kids (4-7 years)',
                                    'Juniors (8-12 years)' => 'Juniors (8-12 years)',
                                    'Teens (13-17 years)' => 'Teens (13-17 years)',
                                    'Adults (18+ years)' => 'Adults (18+ years)',
                                    'Seniors (50+ years)' => 'Seniors (50+ years)',
                                    'Mixed Age' => 'Mixed Age',
                                ])
                                ->searchable()
                                ->required()
                                ->helperText('This field is required')
                                ->validationMessages([
                                    'required' => 'Please select an age group for this batch.',
                                ]),

                            Forms\Components\TextInput::make('max_students')
                                ->label('Maximum Students')
                                ->numeric()
                                ->default(20)
                                ->minValue(1)
                                ->maxValue(100)
                                ->required()
                                ->validationMessages([
                                    'required' => 'Maximum students capacity is required.',
                                    'numeric' => 'Maximum students must be a number.',
                                    'min' => 'Maximum students must be at least 1.',
                                    'max' => 'Maximum students cannot exceed 100.',
                                ]),
                        ]),
                    ]),

                Forms\Components\Section::make('Coach Assignment')
                    ->schema([
                        Forms\Components\Select::make('coach_id')
                            ->label('Assigned Coach')
                            ->options(function () use ($academyId) {
                                // For now, return all academy users since we don't have proper coach roles yet
                                return User::where('academy_id', $academyId)
                                    ->where('is_super_admin', false)
                                    ->pluck('name', 'id');
                            })
                            ->searchable()
                            ->preload()
                            ->helperText('Select a coach to assign to this batch (optional for now)'),
                    ]),

                Forms\Components\Section::make('Syllabus Categories')
                    ->description('Select the categories this batch will teach (Yoga, Karate, Cricket, etc.)')
                    ->schema([
                        Forms\Components\CheckboxList::make('syllabus_categories')
                            ->relationship('syllabusCategories')
                            ->getOptionLabelFromRecordUsing(fn (SyllabusCategory $record): string => $record->name)
                            ->options(function () use ($academyId) {
                                return \App\Models\SyllabusCategory::where('academy_id', $academyId)
                                    ->where('status', 'active')
                                    ->orderBy('name')
                                    ->pluck('name', 'id');
                            })
                            ->columns(3)
                            ->helperText('Select one or more categories that students in this batch will learn')
                            ->required()
                            ->validationMessages([
                                'required' => 'Please select at least one syllabus category.',
                            ]),

                        Forms\Components\Repeater::make('category_details')
                            ->label('Category Details')
                            ->schema([
                                Forms\Components\Hidden::make('syllabus_category_id'),
                                Forms\Components\TextInput::make('category_name')
                                    ->label('Category')
                                    ->disabled()
                                    ->dehydrated(false),
                                Forms\Components\Toggle::make('is_primary')
                                    ->label('Primary Category')
                                    ->helperText('Mark this as the main category for this batch'),
                                Forms\Components\TextInput::make('sort_order')
                                    ->label('Order')
                                    ->numeric()
                                    ->default(0)
                                    ->helperText('Order in which this category is taught'),
                                Forms\Components\Textarea::make('notes')
                                    ->label('Notes')
                                    ->placeholder('Any specific notes for this category in this batch')
                                    ->rows(2),
                            ])
                            ->columns(4)
                            ->collapsible()
                            ->collapsed()
                            ->visible(false) // Will be shown via JavaScript when categories are selected
                            ->helperText('Configure details for each selected category'),
                    ]),

                Forms\Components\Section::make('Schedule')
                    ->schema([
                        Forms\Components\Hidden::make('schedule')
                            ->default(function ($get) {
                                $startTime = $get('start_time');
                                $endTime = $get('end_time');
                                $days = $get('days_of_week');
                                
                                if ($startTime && $endTime && $days) {
                                    $daysText = is_array($days) ? implode(', ', array_map('ucfirst', $days)) : $days;
                                    return $daysText . ' ' . $startTime . ' - ' . $endTime;
                                }
                                
                                return 'Schedule TBD';
                            }),

                        Forms\Components\Grid::make(2)->schema([
                            Forms\Components\TimePicker::make('start_time')
                                ->required()
                                ->seconds(false)
                                ->reactive()
                                ->afterStateUpdated(function ($state, callable $set, callable $get) {
                                    self::updateScheduleField($set, $get);
                                })
                                ->validationMessages([
                                    'required' => 'Start time is required.',
                                ]),

                            Forms\Components\TimePicker::make('end_time')
                                ->required()
                                ->seconds(false)
                                ->after('start_time')
                                ->reactive()
                                ->afterStateUpdated(function ($state, callable $set, callable $get) {
                                    self::updateScheduleField($set, $get);
                                })
                                ->validationMessages([
                                    'required' => 'End time is required.',
                                    'after' => 'End time must be after start time.',
                                ]),
                        ]),

                        Forms\Components\CheckboxList::make('days_of_week')
                            ->label('Days of Week')
                            ->options([
                                'monday' => 'Monday',
                                'tuesday' => 'Tuesday',
                                'wednesday' => 'Wednesday',
                                'thursday' => 'Thursday',
                                'friday' => 'Friday',
                                'saturday' => 'Saturday',
                                'sunday' => 'Sunday',
                            ])
                            ->columns(4)
                            ->required()
                            ->reactive()
                            ->afterStateUpdated(function ($state, callable $set, callable $get) {
                                self::updateScheduleField($set, $get);
                            })
                            ->helperText('Select the days when this batch will run')
                            ->validationMessages([
                                'required' => 'Please select at least one day of the week.',
                            ]),

                        Forms\Components\Grid::make(2)->schema([
                            Forms\Components\DatePicker::make('start_date')
                                ->required()
                                ->default(now())
                                ->validationMessages([
                                    'required' => 'Start date is required.',
                                ]),

                            Forms\Components\DatePicker::make('end_date')
                                ->after('start_date')
                                ->helperText('Leave empty for ongoing batches')
                                ->validationMessages([
                                    'after' => 'End date must be after start date.',
                                ]),
                        ]),

                        Forms\Components\TextInput::make('room_location')
                            ->label('Room/Location')
                            ->maxLength(100)
                            ->placeholder('e.g., Ground Floor - Room A1, Main Hall')
                            ->helperText('Specify the room or location where this batch will be conducted'),
                    ]),

                Forms\Components\Section::make('Fees & Settings')
                    ->schema([
                        Forms\Components\Grid::make(2)->schema([
                            Forms\Components\TextInput::make('monthly_fee')
                                ->label('Monthly Fees')
                                ->numeric()
                                ->prefix('₹')
                                ->step(0.01)
                                ->required()
                                ->minValue(0)
                                ->helperText('Monthly fees for this batch (required)')
                                ->validationMessages([
                                    'required' => 'Monthly fee is required.',
                                    'numeric' => 'Monthly fee must be a valid amount.',
                                    'min' => 'Monthly fee cannot be negative.',
                                ]),

                            Forms\Components\Toggle::make('is_active')
                                ->label('Active')
                                ->default(true)
                                ->helperText('Only active batches can accept new students'),
                        ]),

                        Forms\Components\Textarea::make('notes')
                            ->maxLength(1000)
                            ->rows(3)
                            ->placeholder('Any additional notes about the batch, requirements, or special instructions'),
                    ]),

                Forms\Components\Hidden::make('academy_id')
                    ->default($academyId),
            ]);
    }

    protected static function updateScheduleField(callable $set, callable $get): void
    {
        $startTime = $get('start_time');
        $endTime = $get('end_time');
        $days = $get('days_of_week');
        
        if ($startTime && $endTime && $days) {
            $daysText = is_array($days) ? implode(', ', array_map('ucfirst', $days)) : $days;
            $scheduleText = $daysText . ' ' . $startTime . ' - ' . $endTime;
        } else {
            $scheduleText = 'Schedule TBD';
        }
        
        $set('schedule', $scheduleText);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->heading(fn () => 'Total Batches: ' . \App\Models\Batch::where('academy_id', \Illuminate\Support\Facades\Auth::user()->academy_id)->count())
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::SemiBold),

                Tables\Columns\TextColumn::make('batch_code')
                    ->label('Code')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('branch.name')
                    ->label('Branch')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('coach.name')
                    ->label('Coach')
                    ->searchable()
                    ->default('No coach assigned')
                    ->color(fn ($state) => $state === 'No coach assigned' ? 'danger' : 'primary'),

                Tables\Columns\TextColumn::make('skill_level')
                    ->label('Level')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'beginner' => 'success',
                        'intermediate' => 'warning',
                        'advanced' => 'danger',
                        'mixed' => 'info',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('age_group')
                    ->label('Age Group')
                    ->searchable(),

                Tables\Columns\TextColumn::make('syllabus_categories_list')
                    ->label('Categories')
                    ->getStateUsing(function ($record) {
                        return $record->syllabusCategories->pluck('name')->join(', ') ?: 'No categories';
                    })
                    ->badge()
                    ->separator(',')
                    ->color('info')
                    ->wrap()
                    ->toggleable()
                    ->tooltip(function ($record) {
                        $categories = $record->syllabusCategories;
                        if ($categories->isEmpty()) return 'No categories assigned';
                        
                        return $categories->map(function ($category) {
                            $isPrimary = $category->pivot->is_primary ? ' (Primary)' : '';
                            return $category->name . $isPrimary;
                        })->join("\n");
                    }),

                Tables\Columns\TextColumn::make('students_count')
                    ->label('Students')
                    ->getStateUsing(function ($record) {
                        return $record->getCurrentStudentCount() . '/' . $record->max_students;
                    })
                    ->badge()
                    ->color(function ($record) {
                        $current = $record->getCurrentStudentCount();
                        $max = $record->max_students;
                        $percentage = $max > 0 ? ($current / $max) * 100 : 0;
                        
                        if ($percentage >= 90) return 'danger';
                        if ($percentage >= 70) return 'warning';
                        return 'success';
                    }),

                Tables\Columns\TextColumn::make('schedule')
                    ->label('Schedule')
                    ->getStateUsing(function ($record) {
                        return $record->getTimeSlot() . ' | ' . $record->getDaysOfWeekText();
                    })
                    ->wrap(),

                Tables\Columns\TextColumn::make('monthly_fee')
                    ->label('Monthly Fees')
                    ->money('INR')
                    ->sortable(),

                Tables\Columns\TextColumn::make('status')
                    ->getStateUsing(fn ($record) => $record->getStatusText())
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'Active' => 'success',
                        'Upcoming' => 'info',
                        'Completed' => 'gray',
                        'Inactive' => 'danger',
                        default => 'gray',
                    }),

                Tables\Columns\IconColumn::make('is_active')
                    ->boolean()
                    ->toggleable(isToggledHiddenByDefault: true),

                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('branch_id')
                    ->label('Branch')
                    ->relationship('branch', 'name')
                    ->preload(),

                Tables\Filters\SelectFilter::make('coach_id')
                    ->label('Coach')
                    ->relationship('coach', 'name')
                    ->preload(),

                Tables\Filters\SelectFilter::make('skill_level')
                    ->label('Skill Level')
                    ->options([
                        'beginner' => 'Beginner',
                        'intermediate' => 'Intermediate',
                        'advanced' => 'Advanced',
                        'mixed' => 'Mixed Level',
                    ]),

                Tables\Filters\TernaryFilter::make('is_active')
                    ->label('Active')
                    ->boolean()
                    ->trueLabel('Active batches only')
                    ->falseLabel('Inactive batches only')
                    ->native(false),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->headerActions([
                Tables\Actions\Action::make('print')
                    ->label('Print Batches')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => route('academy.batches.print'))
                    ->openUrlInNewTab(),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function getRelations(): array
    {
        return [
            RelationManagers\StudentsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBatches::route('/'),
            'create' => Pages\CreateBatch::route('/create'),
            'view' => Pages\ViewBatch::route('/{record}'),
            'edit' => Pages\EditBatch::route('/{record}/edit'),
        ];
    }
}
