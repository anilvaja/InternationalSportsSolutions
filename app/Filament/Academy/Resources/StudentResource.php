<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\StudentResource\Pages;
use App\Filament\Academy\Resources\StudentResource\RelationManagers;
use App\Models\Student;
use App\Models\Branch;
use App\Models\Academy;
use App\Models\Fee;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Filters\SelectFilter;
use Filament\Support\Enums\FontWeight;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class StudentResource extends BaseAcademyResource
{
    protected static ?string $model = Student::class;

    protected static ?string $navigationIcon = 'heroicon-o-academic-cap';
    protected static ?string $navigationGroup = 'ACADEMY';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Hidden::make('academy_id')
                    ->default(Auth::user()->academy_id),
                
                Forms\Components\Section::make('Student Limit Information')
                    ->description(function () {
                        $academy = Academy::find(Auth::user()->academy_id);
                        $currentCount = Student::where('academy_id', Auth::user()->academy_id)
                            ->where('status', 'active')
                            ->count();
                        $maxStudents = $academy?->max_students ?? 'Unlimited';
                        
                        return "Active students: {$currentCount} / {$maxStudents}";
                    })
                    ->schema([
                        Forms\Components\Placeholder::make('student_info')
                            ->hiddenLabel()
                            ->content(function () {
                                $academy = Academy::find(Auth::user()->academy_id);
                                $currentCount = Student::where('academy_id', Auth::user()->academy_id)
                                    ->where('status', 'active')
                                    ->count();
                                $maxStudents = $academy?->max_students;
                                
                                if ($maxStudents && $currentCount >= $maxStudents) {
                                    return "⚠️ **Active student limit reached!** Your academy is limited to {$maxStudents} active student(s). Contact support to upgrade your plan.";
                                } elseif ($maxStudents) {
                                    $remaining = $maxStudents - $currentCount;
                                    return "✅ You can register {$remaining} more active student(s).";
                                } else {
                                    return "✅ No student limit set for your academy.";
                                }
                            })
                            ->columnSpanFull(),
                    ])
                    ->collapsible()
                    ->collapsed(false)
                    ->visible(fn () => Auth::user()->role === 'academy_admin' || Auth::user()->is_super_admin),
                
                Forms\Components\Section::make('Student Information')
                    ->description('Basic student details and identification')
                    ->schema([
                        Forms\Components\Grid::make(3)
                            ->schema([
                                Forms\Components\TextInput::make('student_id')
                                    ->label('Student ID')
                                    ->required()
                                    ->unique(Student::class, 'student_id', ignoreRecord: true)
                                    ->default(function () {
                                        $academyId = Auth::user()->academy_id;
                                        $count = Student::where('academy_id', $academyId)
                                            ->where('status', 'active')
                                            ->count() + 1;
                                        return 'STU' . str_pad($academyId, 2, '0', STR_PAD_LEFT) . date('Y') . sprintf('%04d', $count);
                                    })
                                    ->helperText('Unique student identifier for this academy'),
                                
                                Forms\Components\TextInput::make('first_name')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('last_name')
                                    ->required()
                                    ->maxLength(255),
                            ]),
                        
                        Forms\Components\Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('email')
                                    ->email()
                                    ->unique(Student::class, 'email', ignoreRecord: true)
                                    ->maxLength(255)
                                    ->helperText('Required for student portal access'),
                                
                                Forms\Components\TextInput::make('password')
                                    ->password()
                                    ->required(fn (string $context): bool => $context === 'create')
                                    ->dehydrated(fn (?string $state): bool => filled($state))
                                    ->revealable()
                                    ->minLength(6)
                                    ->maxLength(255)
                                    ->helperText('Minimum 6 characters. Leave blank to keep current password.')
                                    ->hint(fn (string $context): ?string => $context === 'edit' ? 'Leave blank to keep current password' : null),
                            ]),
                        
                        Forms\Components\Grid::make(4)
                            ->schema([
                                Forms\Components\TextInput::make('phone')
                                    ->tel()
                                    ->maxLength(255),
                                
                                Forms\Components\DatePicker::make('date_of_birth')
                                    ->required()
                                    ->maxDate(now()),
                                
                                Forms\Components\Select::make('gender')
                                    ->required()
                                    ->options([
                                        'male' => 'Male',
                                        'female' => 'Female',
                                        'other' => 'Other',
                                    ]),
                                
                                Forms\Components\Select::make('branch_id')
                                    ->label('Branch')
                                    ->required()
                                    ->options(function () {
                                        return Branch::forAcademy(Auth::user()->academy_id)
                                            ->where('status', 'active')
                                            ->pluck('name', 'id');
                                    })
                                    ->searchable()
                                    ->preload(),
                            ]),
                        
                        Forms\Components\DatePicker::make('enrollment_date')
                            ->required()
                            ->default(now())
                            ->columnSpan(1),
                        
                        Forms\Components\Textarea::make('address')
                            ->required()
                            ->rows(2)
                            ->columnSpanFull(),
                        
                        Forms\Components\Grid::make(4)
                            ->schema([
                                Forms\Components\TextInput::make('city')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('state')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('postal_code')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('country')
                                    ->required()
                                    ->maxLength(255)
                                    ->default('India'),
                            ]),
                    ]),
                
                Forms\Components\Section::make('Parent/Guardian Information')
                    ->schema([
                        Forms\Components\Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('parent_name')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('parent_phone')
                                    ->required()
                                    ->tel()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('parent_email')
                                    ->email()
                                    ->maxLength(255),
                                
                                Forms\Components\Select::make('parent_relationship')
                                    ->required()
                                    ->options([
                                        'parent' => 'Parent',
                                        'father' => 'Father',
                                        'mother' => 'Mother',
                                        'guardian' => 'Guardian',
                                        'grandparent' => 'Grandparent',
                                        'other' => 'Other',
                                    ])
                                    ->default('parent'),
                            ]),
                    ]),
                
                Forms\Components\Section::make('Emergency Contact')
                    ->schema([
                        Forms\Components\Grid::make(3)
                            ->schema([
                                Forms\Components\TextInput::make('emergency_contact_name')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('emergency_contact_phone')
                                    ->required()
                                    ->tel()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('emergency_contact_relationship')
                                    ->required()
                                    ->maxLength(255),
                            ]),
                    ]),
                
                Forms\Components\Section::make('Medical Information')
                    ->schema([
                        Forms\Components\Grid::make(2)
                            ->schema([
                                Forms\Components\Textarea::make('medical_conditions')
                                    ->rows(2)
                                    ->helperText('Any medical conditions or health issues'),
                                
                                Forms\Components\Textarea::make('allergies')
                                    ->rows(2)
                                    ->helperText('Known allergies'),
                                
                                Forms\Components\Textarea::make('medications')
                                    ->rows(2)
                                    ->helperText('Current medications'),
                                
                                Forms\Components\Select::make('blood_group')
                                    ->options([
                                        'A+' => 'A+',
                                        'A-' => 'A-',
                                        'B+' => 'B+',
                                        'B-' => 'B-',
                                        'AB+' => 'AB+',
                                        'AB-' => 'AB-',
                                        'O+' => 'O+',
                                        'O-' => 'O-',
                                    ])
                                    ->searchable(),
                            ]),
                        
                        Forms\Components\Textarea::make('dietary_restrictions')
                            ->rows(2)
                            ->columnSpanFull()
                            ->helperText('Any dietary restrictions or special requirements'),
                    ])
                    ->collapsible(),
                
                Forms\Components\Section::make('Academy Information')
                    ->schema([
                        Forms\Components\Grid::make(3)
                            ->schema([
                                Forms\Components\Select::make('status')
                                    ->required()
                                    ->options([
                                        'active' => 'Active',
                                        'inactive' => 'Inactive',
                                        'suspended' => 'Suspended',
                                        'graduated' => 'Graduated',
                                    ])
                                    ->default('active'),
                                
                                Forms\Components\Select::make('belt_level')
                                    ->options([
                                        'white' => 'White Belt',
                                        'yellow' => 'Yellow Belt',
                                        'orange' => 'Orange Belt',
                                        'green' => 'Green Belt',
                                        'blue' => 'Blue Belt',
                                        'purple' => 'Purple Belt',
                                        'brown' => 'Brown Belt',
                                        'black' => 'Black Belt',
                                    ])
                                    ->searchable(),
                                
                                Forms\Components\FileUpload::make('photo')
                                    ->image()
                                    ->imageEditor()
                                    ->directory('students/photos')
                                    ->helperText('Student photo'),
                            ]),
                        
                        Forms\Components\Textarea::make('notes')
                            ->rows(3)
                            ->columnSpanFull()
                            ->helperText('Additional notes about the student'),
                        
                        Forms\Components\FileUpload::make('documents')
                            ->multiple()
                            ->directory('students/documents')
                            ->acceptedFileTypes(['application/pdf', 'image/jpeg', 'image/png'])
                            ->columnSpanFull()
                            ->helperText('Upload relevant documents (ID proof, medical certificates, etc.)'),
                    ])
                    ->collapsible(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->heading(fn () => 'Total Students: ' . \App\Models\Student::where('academy_id', \Illuminate\Support\Facades\Auth::user()->academy_id)->count())
            ->columns([
                Tables\Columns\ImageColumn::make('photo')
                    ->circular()
                    ->defaultImageUrl(url('images/default-avatar.svg'))
                    ->size(50)
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('student_id')
                    ->searchable()
                    ->sortable()
                    ->badge()
                    ->color('primary'),
                
                Tables\Columns\TextColumn::make('first_name')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::Bold),
                
                Tables\Columns\TextColumn::make('last_name')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::Bold),
                
                Tables\Columns\TextColumn::make('branch.name')
                    ->label('Branch')
                    ->sortable()
                    ->badge()
                    ->color('info'),
                
                Tables\Columns\TextColumn::make('academy.name')
                    ->label('Academy')
                    ->sortable()
                    ->badge()
                    ->color('success')
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\TextColumn::make('phone')
                    ->searchable()
                    ->toggleable()
                    ->icon('heroicon-m-phone'),
                
                Tables\Columns\TextColumn::make('belt_level')
                    ->badge()
                    ->color(fn (?string $state): string => match ($state) {
                        'white' => 'gray',
                        'yellow' => 'warning',
                        'orange' => 'danger',
                        'green' => 'success',
                        'blue' => 'info',
                        'purple' => 'primary',
                        'brown' => 'warning',
                        'black' => 'gray',
                        default => 'gray',
                    })
                    ->placeholder('Not assigned')
                    ->toggleable(),

                Tables\Columns\TextColumn::make('activeBatches.name')
                    ->label('Current Batch')
                    ->badge()
                    ->color('primary')
                    ->placeholder('Not enrolled')
                    ->formatStateUsing(function (Student $record) {
                        $activeBatch = $record->getActiveBatch();
                        return $activeBatch ? $activeBatch->name : 'Not enrolled';
                    })
                    ->sortable()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'inactive' => 'gray',
                        'suspended' => 'danger',
                        'graduated' => 'warning',
                    })
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('enrollment_date')
                    ->date()
                    ->sortable()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('branch_id')
                    ->label('Branch')
                    ->options(function () {
                        return Branch::forAcademy(Auth::user()->academy_id)
                            ->pluck('name', 'id');
                    })
                    ->preload(),
                
                SelectFilter::make('status')
                    ->options([
                        'active' => 'Active',
                        'inactive' => 'Inactive',
                        'suspended' => 'Suspended',
                        'graduated' => 'Graduated',
                    ]),
                
                SelectFilter::make('belt_level')
                    ->options([
                        'white' => 'White Belt',
                        'yellow' => 'Yellow Belt',
                        'orange' => 'Orange Belt',
                        'green' => 'Green Belt',
                        'blue' => 'Blue Belt',
                        'purple' => 'Purple Belt',
                        'brown' => 'Brown Belt',
                        'black' => 'Black Belt',
                    ]),
                
                SelectFilter::make('gender')
                    ->options([
                        'male' => 'Male',
                        'female' => 'Female',
                        'other' => 'Other',
                    ]),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
                Tables\Actions\Action::make('pay_fees')
                    ->label('Pay Fees')
                    ->icon('heroicon-m-banknotes')
                    ->color('success')
                    ->visible(function ($record) {
                        // Show only if student has pending or overdue fees
                        return Fee::where('student_id', $record->id)
                            ->whereIn('status', ['pending', 'overdue'])
                            ->exists();
                    })
                    ->url(function ($record) {
                        // Find the most urgent fee (overdue first, then pending)
                        $urgentFee = Fee::where('student_id', $record->id)
                            ->whereIn('status', ['pending', 'overdue'])
                            ->orderByRaw("CASE WHEN status = 'overdue' THEN 1 ELSE 2 END")
                            ->orderBy('due_date', 'asc')
                            ->first();
                        
                        return $urgentFee ? route('filament.academy.resources.fees.edit', ['record' => $urgentFee->id]) : null;
                    })
                    ->openUrlInNewTab(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    
                    Tables\Actions\BulkAction::make('activate')
                        ->label('Activate Students')
                        ->icon('heroicon-o-check-circle')
                        ->color('success')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['status' => 'active']);
                            });
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\BulkAction::make('suspend')
                        ->label('Suspend Students')
                        ->icon('heroicon-o-x-circle')
                        ->color('danger')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['status' => 'suspended']);
                            });
                        })
                        ->requiresConfirmation(),
                ]),
            ])
            ->headerActions([
                Tables\Actions\Action::make('print')
                    ->label('Print Students')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => route('academy.students.print'))
                    ->openUrlInNewTab()
                    ->visible(fn () => Auth::user()->is_super_admin),
            ])
            ->defaultSort('created_at', 'desc');
    }

    // Scope to current academy
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->forAcademy(Auth::user()->academy_id);
    }

    // Permission logic now handled by BaseAcademyResource

    public static function getRelations(): array
    {
        return [
            //
        ];
    }
    
    // Override permission methods to use correct permission names
    public static function canViewAny(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('view_students');
    }

    public static function canCreate(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('create_students');
    }

    public static function canEdit($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('edit_students');
    }

    public static function canDelete($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('delete_students');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListStudents::route('/'),
            'create' => Pages\CreateStudent::route('/create'),
            'view' => Pages\ViewStudent::route('/{record}'),
            'edit' => Pages\EditStudent::route('/{record}/edit'),
        ];
    }
    
    // Permission logic now handled by BaseAcademyResource
}
