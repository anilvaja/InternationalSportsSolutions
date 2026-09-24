<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\EventResource\Pages;
use App\Filament\Academy\Resources\EventResource\RelationManagers;
use App\Filament\Academy\Resources\EventFeeResource;
use App\Models\Event;
use App\Models\Student;
use App\Models\Branch;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;
use Filament\Tables\Actions\ActionGroup;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class EventResource extends BaseAcademyResource
{
    protected static ?string $model = Event::class;

    protected static ?string $navigationIcon = 'heroicon-o-trophy';

    protected static ?string $navigationGroup = 'SCHEDULE & EVENTS';

    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Event Information')
                    ->description('Basic event details and information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('title')
                                    ->required()
                                    ->maxLength(255)
                                    ->columnSpanFull(),
                                
                                Forms\Components\Textarea::make('description')
                                    ->required()
                                    ->rows(3)
                                    ->columnSpanFull(),
                                
                                Forms\Components\RichEditor::make('content')
                                    ->label('Detailed Content')
                                    ->columnSpanFull(),
                                
                                Forms\Components\Select::make('type')
                                    ->options([
                                        'general' => 'General Event',
                                        'training' => 'Training Session',
                                        'competition' => 'Competition',
                                        'workshop' => 'Workshop',
                                        'seminar' => 'Seminar',
                                        'grading' => 'Belt Grading',
                                        'social' => 'Social Event',
                                    ])
                                    ->required()
                                    ->default('general'),
                                
                                Forms\Components\Select::make('status')
                                    ->options([
                                        'draft' => 'Draft',
                                        'published' => 'Published',
                                        'cancelled' => 'Cancelled',
                                    ])
                                    ->required()
                                    ->default('draft'),
                            ]),
                    ]),

                Section::make('Date & Time')
                    ->description('Event scheduling information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\DateTimePicker::make('event_date')
                                    ->required()
                                    ->native(false)
                                    ->seconds(false),
                                
                                Forms\Components\DateTimePicker::make('event_end_date')
                                    ->label('End Date & Time')
                                    ->native(false)
                                    ->seconds(false)
                                    ->after('event_date'),
                            ]),
                    ]),

                Section::make('Location & Venue')
                    ->description('Where the event will take place')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('location')
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('venue')
                                    ->maxLength(255),
                            ]),
                    ]),

                Section::make('Registration & Fees')
                    ->description('RSVP and payment configuration')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                Forms\Components\Toggle::make('requires_rsvp')
                                    ->label('Requires RSVP')
                                    ->default(true),
                                
                                Forms\Components\TextInput::make('max_participants')
                                    ->label('Maximum Participants')
                                    ->numeric()
                                    ->minValue(1),
                                
                                Forms\Components\TextInput::make('fee')
                                    ->label('Registration Fee')
                                    ->numeric()
                                    ->prefix('₹')
                                    ->minValue(0)
                                    ->step(0.01),
                            ]),
                        
                        Forms\Components\DateTimePicker::make('rsvp_deadline')
                            ->label('RSVP Deadline')
                            ->native(false)
                            ->seconds(false)
                            ->visible(fn (Forms\Get $get) => $get('requires_rsvp')),
                    ]),

                Section::make('Eligibility Criteria')
                    ->description('Filter students who can participate')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\Toggle::make('eligibility_criteria.all_students')
                                    ->label('All Students')
                                    ->helperText('Invite all students in the academy, ignoring all filters below.'),
                                Forms\Components\Select::make('eligibility_criteria.belt_levels')
                                    ->label('Belt Levels')
                                    ->multiple()
                                    ->options([
                                        'White' => 'White Belt',
                                        'Yellow' => 'Yellow Belt',
                                        'Orange' => 'Orange Belt',
                                        'Green' => 'Green Belt',
                                        'Blue' => 'Blue Belt',
                                        'Brown' => 'Brown Belt',
                                        'Black' => 'Black Belt',
                                    ])
                                    ->disabled(fn (Forms\Get $get) => $get('eligibility_criteria.all_students')),
                                Forms\Components\Select::make('eligibility_criteria.gender')
                                    ->label('Gender')
                                    ->multiple()
                                    ->options([
                                        'male' => 'Male',
                                        'female' => 'Female',
                                        'other' => 'Other',
                                    ])
                                    ->disabled(fn (Forms\Get $get) => $get('eligibility_criteria.all_students')),
                                Forms\Components\TextInput::make('eligibility_criteria.age_min')
                                    ->label('Minimum Age')
                                    ->numeric()
                                    ->minValue(0)
                                    ->disabled(fn (Forms\Get $get) => $get('eligibility_criteria.all_students')),
                                Forms\Components\TextInput::make('eligibility_criteria.age_max')
                                    ->label('Maximum Age')
                                    ->numeric()
                                    ->minValue(0)
                                    ->disabled(fn (Forms\Get $get) => $get('eligibility_criteria.all_students')),
                                Forms\Components\Select::make('eligibility_criteria.status')
                                    ->label('Student Status')
                                    ->multiple()
                                    ->options([
                                        'active' => 'Active',
                                        'inactive' => 'Inactive',
                                        'suspended' => 'Suspended',
                                    ])
                                    ->default(['active'])
                                    ->disabled(fn (Forms\Get $get) => $get('eligibility_criteria.all_students')),
                                Forms\Components\Select::make('eligibility_criteria.branches')
                                    ->label('Branches')
                                    ->multiple()
                                    ->options(function () {
                                        return Branch::where('academy_id', Auth::user()->academy_id)
                                            ->pluck('name', 'id');
                                    })
                                    ->disabled(fn (Forms\Get $get) => $get('eligibility_criteria.all_students')),
                            ]),
                    ]),

                Section::make('Manual Student Selection')
                    ->description('Add specific students manually by searching name, email, or phone')
                    ->schema([
                        Forms\Components\Select::make('manual_participants')
                            ->label('Add Specific Students')
                            ->multiple()
                            ->searchable()
                            ->getSearchResultsUsing(function (string $search): array {
                                if (strlen($search) < 2) {
                                    return [];
                                }
                                
                                return Student::where('academy_id', Auth::user()->academy_id)
                                    ->where(function ($query) use ($search) {
                                        $query->where('first_name', 'like', "%{$search}%")
                                            ->orWhere('last_name', 'like', "%{$search}%")
                                            ->orWhere('email', 'like', "%{$search}%")
                                            ->orWhere('phone', 'like', "%{$search}%")
                                            ->orWhere('student_id', 'like', "%{$search}%")
                                            ->orWhereRaw("(first_name || ' ' || last_name) LIKE ?", ["%{$search}%"]);
                                    })
                                    ->limit(50)
                                    ->get()
                                    ->mapWithKeys(function ($student) {
                                        return [
                                            $student->id => sprintf(
                                                '%s (%s) - %s - %s',
                                                $student->getFullNameAttribute(),
                                                $student->student_id ?? 'No ID',
                                                $student->email,
                                                $student->phone ?? 'No phone'
                                            )
                                        ];
                                    })
                                    ->toArray();
                            })
                            ->getOptionLabelsUsing(function (array $values): array {
                                return Student::whereIn('id', $values)
                                    ->get()
                                    ->mapWithKeys(function ($student) {
                                        return [
                                            $student->id => sprintf(
                                                '%s (%s) - %s - %s',
                                                $student->getFullNameAttribute(),
                                                $student->student_id ?? 'No ID',
                                                $student->email,
                                                $student->phone ?? 'No phone'
                                            )
                                        ];
                                    })
                                    ->toArray();
                            })
                            ->placeholder('Search by name, email, phone, or student ID...')
                            ->helperText('Type at least 2 characters to search. Selected students will be invited regardless of eligibility criteria.')
                            ->columnSpanFull(),

                        Forms\Components\Placeholder::make('selection_info')
                            ->label('Selection Summary')
                            ->content(function (Forms\Get $get): string {
                                $manual = $get('manual_participants') ?? [];
                                $manualCount = count($manual);
                                
                                $content = "Manual students selected: {$manualCount}";
                                
                                if ($manualCount > 0) {
                                    $content .= "\n\nNote: These students will be invited in addition to those matching the eligibility criteria above.";
                                }
                                
                                return $content;
                            })
                            ->columnSpanFull(),
                    ]),

                Section::make('Notifications')
                    ->description('How participants will be notified')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                Forms\Components\Toggle::make('dashboard_notifications')
                                    ->label('Dashboard Notifications')
                                    ->default(true),
                                
                                Forms\Components\Toggle::make('email_notifications')
                                    ->label('Email Notifications')
                                    ->default(true),
                                
                                Forms\Components\Toggle::make('sms_notifications')
                                    ->label('SMS Notifications')
                                    ->default(false),
                            ]),
                    ]),

                Section::make('Media & Attachments')
                    ->description('Event images and documents')
                    ->schema([
                        Forms\Components\FileUpload::make('image')
                            ->label('Event Image')
                            ->image()
                            ->directory('event-images')
                            ->imageEditor()
                            ->columnSpanFull(),
                        
                        Forms\Components\FileUpload::make('attachments')
                            ->label('Attachments')
                            ->multiple()
                            ->directory('event-attachments')
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('image')
                    ->square()
                    ->size(60),
                
                Tables\Columns\TextColumn::make('title')
                    ->searchable()
                    ->sortable()
                    ->weight('medium'),
                
                Tables\Columns\BadgeColumn::make('type')
                    ->colors([
                        'primary' => 'general',
                        'info' => 'training',
                        'warning' => 'competition',
                        'success' => 'workshop',
                        'danger' => 'grading',
                    ]),
                
                Tables\Columns\BadgeColumn::make('status')
                    ->colors([
                        'gray' => 'draft',
                        'success' => 'published',
                        'danger' => 'cancelled',
                    ]),
                
                Tables\Columns\TextColumn::make('event_date')
                    ->label('Date & Time')
                    ->dateTime('d M Y, H:i')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('participants_count')
                    ->label('Participants')
                    ->counts('participants')
                    ->badge()
                    ->color('info'),
                
                Tables\Columns\TextColumn::make('interested_count')
                    ->label('Interested')
                    ->getStateUsing(fn ($record) => $record->interestedParticipants()->count())
                    ->badge()
                    ->color('success'),
                
                Tables\Columns\TextColumn::make('fee')
                    ->money('INR')
                    ->sortable(),
                
                Tables\Columns\IconColumn::make('requires_rsvp')
                    ->label('RSVP')
                    ->boolean(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'draft' => 'Draft',
                        'published' => 'Published',
                        'cancelled' => 'Cancelled',
                    ]),
                
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
                
                Tables\Filters\Filter::make('upcoming')
                    ->query(fn (Builder $query): Builder => $query->where('event_date', '>', now())),
                
                Tables\Filters\TrashedFilter::make(),
            ])
            ->actions([
                ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\EditAction::make(),
                    
                    Tables\Actions\Action::make('send_invitations')
                        ->label('Send Invitations')
                        ->icon('heroicon-o-paper-airplane')
                        ->color('success')
                        ->visible(fn ($record) => $record->status === 'published')
                        ->action(function ($record) {
                            $invitedCount = $record->sendInvitations();
                            
                            Notification::make()
                                ->success()
                                ->title('Invitations Sent')
                                ->body("Invitations sent to {$invitedCount} eligible students.")
                                ->send();
                        })
                        ->requiresConfirmation()
                        ->modalHeading('Send Event Invitations')
                        ->modalDescription('This will send invitations to all eligible students based on the criteria you set.'),
                    
                    Tables\Actions\Action::make('view_participants')
                        ->label('View Participants')
                        ->icon('heroicon-o-users')
                        ->color('info')
                        ->url(fn ($record) => static::getUrl('participants', ['record' => $record])),
                    
                    Tables\Actions\Action::make('manage_fees')
                        ->label('Manage Fees')
                        ->icon('heroicon-o-currency-dollar')
                        ->color('warning')
                        ->visible(fn ($record) => $record->fee > 0)
                        ->action(function ($record) {
                            $createdCount = $record->createFeesForAllParticipants();
                            
                            Notification::make()
                                ->success()
                                ->title('Fees Created')
                                ->body("Fee records created for {$createdCount} participants.")
                                ->send();
                        })
                        ->requiresConfirmation()
                        ->modalHeading('Create Fee Records')
                        ->modalDescription('This will create fee records for all event participants. Existing fee records will not be duplicated.'),
                    
                    Tables\Actions\Action::make('view_fees')
                        ->label('View Fees')
                        ->icon('heroicon-o-banknotes')
                        ->color('success')
                        ->visible(fn ($record) => $record->fee > 0)
                        ->url(fn ($record) => EventFeeResource::getUrl('index', ['tableFilters' => ['event' => ['value' => $record->id]]])),
                    
                    Tables\Actions\Action::make('export_interested')
                        ->label('Export Interested')
                        ->icon('heroicon-o-arrow-down-tray')
                        ->color('warning')
                        ->visible(fn ($record) => $record->interestedParticipants()->exists())
                        ->action(function ($record) {
                            return static::exportInterestedStudents($record);
                        }),
                        
                    Tables\Actions\DeleteAction::make(),
                    Tables\Actions\RestoreAction::make(),
                ]),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    Tables\Actions\RestoreBulkAction::make(),
                ]),
            ])
            ->defaultSort('event_date', 'desc');
    }

    public static function getRelations(): array
    {
        return [
            RelationManagers\FeesRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListEvents::route('/'),
            'create' => Pages\CreateEvent::route('/create'),
            'edit' => Pages\EditEvent::route('/{record}/edit'),
            'view' => Pages\ViewEvent::route('/{record}'),
            'participants' => Pages\EventParticipants::route('/{record}/participants'),
        ];
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where('academy_id', Auth::user()->academy_id)
            ->withoutGlobalScopes([
                SoftDeletingScope::class,
            ]);
    }

    public static function exportInterestedStudents(Event $event)
    {
        $participants = $event->interestedParticipants()
            ->with(['student.branch'])
            ->get();

        $csvData = [];
        $csvData[] = [
            'Student ID',
            'Student Name', 
            'Email',
            'Phone',
            'Belt Level',
            'Age',
            'Gender',
            'Branch',
            'Response Date',
            'Response Notes',
            'Payment Status',
            'Payment Required',
            'Fee Amount'
        ];

        foreach ($participants as $participant) {
            $student = $participant->student;
            $csvData[] = [
                $student->student_id ?? 'N/A',
                $student->name ?? 'N/A',
                $student->email ?? 'N/A',
                $student->phone ?? 'N/A',
                $student->belt_level ?? 'N/A',
                $student->age ?? 'N/A',
                ucfirst($student->gender ?? 'N/A'),
                $student->branch->name ?? 'N/A',
                $participant->responded_at ? $participant->responded_at->format('Y-m-d H:i') : 'N/A',
                $participant->response_notes ?? 'N/A',
                ucfirst($participant->payment_status ?? 'pending'),
                $participant->payment_required ? 'Yes' : 'No',
                $event->fee > 0 ? '₹' . number_format($event->fee, 2) : 'Free'
            ];
        }

        $filename = 'interested_students_' . Str::slug($event->title) . '_' . now()->format('Y_m_d_H_i_s') . '.csv';
        
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        $callback = function() use ($csvData) {
            $file = fopen('php://output', 'w');
            foreach ($csvData as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        };

        Notification::make()
            ->title('Export completed successfully!')
            ->success()
            ->send();

        return response()->stream($callback, 200, $headers);
    }

    // Override permission methods to use correct permission names
    public static function canViewAny(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('view_events');
    }

    public static function canCreate(): bool
    {
        return \App\Support\AcademyPermissionHelper::can('create_events');
    }

    public static function canEdit($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('edit_events');
    }

    public static function canDelete($record): bool
    {
        return \App\Support\AcademyPermissionHelper::can('delete_events');
    }
}
