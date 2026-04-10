<?php

namespace App\Filament\Student\Pages;

use Filament\Pages\Page;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Placeholder;
use Filament\Actions\Action;
use Filament\Support\Exceptions\Halt;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Filament\Notifications\Notification;
use App\Models\Student;

class Profile extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-user-circle';
    
    protected static string $view = 'filament.student.pages.profile';
    
    protected static ?string $navigationLabel = 'My Profile';
    
    protected static ?string $navigationGroup = 'My Dashboard';
    
    protected static ?int $navigationSort = 2;

    public ?array $data = [];

    public function mount(): void
    {
        try {
            /** @var \App\Models\Student $student */
            $student = Auth::guard('student')->user();
            
            if (!$student) {
                abort(403, 'Access denied');
            }
            
            // Get safe values for all fields with additional error handling
            $this->data = [
                'student_id' => $this->getSafeString($student->student_id ?? ''),
                'first_name' => $this->getSafeString($student->first_name ?? ''),
                'last_name' => $this->getSafeString($student->last_name ?? ''),
                'email' => $this->getSafeString($student->email ?? ''),
                'phone' => $this->getSafeString($student->phone ?? ''),
                'date_of_birth' => $student->date_of_birth,
                'gender' => $this->getSafeString($student->gender ?? ''),
                'blood_group' => $this->getSafeString($student->blood_group ?? ''),
                'address' => $this->getSafeString($student->address ?? ''),
                'city' => $this->getSafeString($student->city ?? ''),
                'state' => $this->getSafeString($student->state ?? ''),
                'postal_code' => $this->getSafeString($student->postal_code ?? ''),
                'country' => $this->getSafeString($student->country ?? 'India'),
                'parent_name' => $this->getSafeString($student->parent_name ?? ''),
                'parent_phone' => $this->getSafeString($student->parent_phone ?? ''),
                'parent_email' => $this->getSafeString($student->parent_email ?? ''),
                'parent_relationship' => $this->getSafeString($student->parent_relationship ?? ''),
                'emergency_contact_name' => $this->getSafeString($student->emergency_contact_name ?? ''),
                'emergency_contact_phone' => $this->getSafeString($student->emergency_contact_phone ?? ''),
                'emergency_contact_relationship' => $this->getSafeString($student->emergency_contact_relationship ?? ''),
                'medical_conditions' => $this->getSafeString($student->medical_conditions ?? ''),
                'allergies' => $this->getSafeString($student->allergies ?? ''),
                'medications' => $this->getSafeString($student->medications ?? ''),
                'dietary_restrictions' => $this->getSafeString($student->dietary_restrictions ?? ''),
                'photo' => $student->photo,
                'belt_level' => $this->getSafeString($student->belt_level ?? ''),
                'enrollment_date' => $student->enrollment_date,
                'status' => $this->getSafeString($student->status ?? 'active'),
            ];
            
            $this->form->fill($this->data);
            
        } catch (\Exception $e) {
            // Log the error for debugging
            Log::error('Profile mount error: ' . $e->getMessage(), [
                'user_id' => auth('student')->id(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Set default safe data
            $this->data = [
                'student_id' => '',
                'first_name' => '',
                'last_name' => '',
                'email' => '',
                'phone' => '',
                'date_of_birth' => null,
                'gender' => '',
                'blood_group' => '',
                'address' => '',
                'city' => '',
                'state' => '',
                'postal_code' => '',
                'country' => 'India',
                'parent_name' => '',
                'parent_phone' => '',
                'parent_email' => '',
                'parent_relationship' => '',
                'emergency_contact_name' => '',
                'emergency_contact_phone' => '',
                'emergency_contact_relationship' => '',
                'medical_conditions' => '',
                'allergies' => '',
                'medications' => '',
                'dietary_restrictions' => '',
                'photo' => null,
                'belt_level' => '',
                'enrollment_date' => null,
                'status' => 'active',
            ];
            
            $this->form->fill($this->data);
        }
    }

    private function getSafeString($value): string
    {
        if (is_string($value)) {
            return $value;
        }
        
        if (is_array($value)) {
            return isset($value[0]) && is_string($value[0]) ? $value[0] : '';
        }
        
        return (string) $value;
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                // Profile Overview Section
                Section::make('Profile Overview')
                    ->description('Your current profile status and basic information')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                Placeholder::make('student_info')
                                    ->label('Student ID')
                                    ->content(fn (): string => $this->data['student_id'] ?? 'N/A'),
                                    
                                Placeholder::make('enrollment_info')
                                    ->label('Enrollment Date')
                                    ->content(fn (): string => $this->data['enrollment_date'] 
                                        ? $this->data['enrollment_date']->format('d M Y') 
                                        : 'N/A'),
                                        
                                Placeholder::make('status_info')
                                    ->label('Status')
                                    ->content(fn (): string => ucfirst($this->data['status'] ?? 'Active')),
                            ]),
                            
                        FileUpload::make('photo')
                            ->label('Profile Photo')
                            ->image()
                            ->directory('student-photos')
                            ->imageEditor()
                            ->imageEditorAspectRatios([
                                '1:1',
                            ])
                            ->columnSpanFull(),
                    ])
                    ->collapsible(),

                // Personal Information Section
                Section::make('Personal Information')
                    ->description('Update your personal details')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextInput::make('first_name')
                                    ->label('First Name')
                                    ->required()
                                    ->maxLength(255),
                                    
                                TextInput::make('last_name')
                                    ->label('Last Name')
                                    ->required()
                                    ->maxLength(255),
                            ]),
                            
                        Grid::make(3)
                            ->schema([
                                TextInput::make('email')
                                    ->label('Email Address')
                                    ->email()
                                    ->required()
                                    ->maxLength(255)
                                    ->helperText('Used for login and notifications'),
                                    
                                TextInput::make('phone')
                                    ->label('Phone Number')
                                    ->tel()
                                    ->maxLength(20),
                                    
                                DatePicker::make('date_of_birth')
                                    ->label('Date of Birth')
                                    ->native(false)
                                    ->displayFormat('d/m/Y')
                                    ->maxDate(now()),
                            ]),
                            
                        Grid::make(2)
                            ->schema([
                                Select::make('gender')
                                    ->label('Gender')
                                    ->options([
                                        'male' => 'Male',
                                        'female' => 'Female',
                                        'other' => 'Other',
                                    ]),
                                    
                                Select::make('blood_group')
                                    ->label('Blood Group')
                                    ->options([
                                        'A+' => 'A+',
                                        'A-' => 'A-',
                                        'B+' => 'B+',
                                        'B-' => 'B-',
                                        'AB+' => 'AB+',
                                        'AB-' => 'AB-',
                                        'O+' => 'O+',
                                        'O-' => 'O-',
                                    ]),
                            ]),
                    ])
                    ->collapsible(),

                // Contact Information Section
                Section::make('Contact Information')
                    ->description('Your address and location details')
                    ->schema([
                        Textarea::make('address')
                            ->label('Address')
                            ->rows(3)
                            ->maxLength(500)
                            ->columnSpanFull(),
                            
                        Grid::make(4)
                            ->schema([
                                TextInput::make('city')
                                    ->label('City')
                                    ->maxLength(255),
                                    
                                TextInput::make('state')
                                    ->label('State')
                                    ->maxLength(255),
                                    
                                TextInput::make('postal_code')
                                    ->label('Postal Code')
                                    ->maxLength(20),
                                    
                                TextInput::make('country')
                                    ->label('Country')
                                    ->maxLength(255)
                                    ->default('India'),
                            ]),
                    ])
                    ->collapsible(),

                // Parent/Guardian Information Section
                Section::make('Parent/Guardian Information')
                    ->description('Emergency contact and guardian details')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextInput::make('parent_name')
                                    ->label('Parent/Guardian Name')
                                    ->maxLength(255),
                                    
                                TextInput::make('parent_phone')
                                    ->label('Parent/Guardian Phone')
                                    ->tel()
                                    ->maxLength(20),
                            ]),
                            
                        Grid::make(2)
                            ->schema([
                                TextInput::make('parent_email')
                                    ->label('Parent/Guardian Email')
                                    ->email()
                                    ->maxLength(255),
                                    
                                Select::make('parent_relationship')
                                    ->label('Relationship')
                                    ->options([
                                        'father' => 'Father',
                                        'mother' => 'Mother',
                                        'guardian' => 'Guardian',
                                        'grandparent' => 'Grandparent',
                                        'other' => 'Other',
                                    ]),
                            ]),
                    ])
                    ->collapsible(),

                // Emergency Contact Section
                Section::make('Emergency Contact')
                    ->description('Additional emergency contact person')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                TextInput::make('emergency_contact_name')
                                    ->label('Emergency Contact Name')
                                    ->maxLength(255),
                                    
                                TextInput::make('emergency_contact_phone')
                                    ->label('Emergency Contact Phone')
                                    ->tel()
                                    ->maxLength(20),
                                    
                                TextInput::make('emergency_contact_relationship')
                                    ->label('Relationship')
                                    ->maxLength(255)
                                    ->placeholder('e.g., Uncle, Aunt, Friend'),
                            ]),
                    ])
                    ->collapsible(),

                // Medical Information Section
                Section::make('Medical Information')
                    ->description('Health and medical details for safety purposes')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Textarea::make('medical_conditions')
                                    ->label('Medical Conditions')
                                    ->rows(3)
                                    ->maxLength(1000)
                                    ->helperText('Any chronic conditions, injuries, or health issues'),
                                    
                                Textarea::make('allergies')
                                    ->label('Allergies')
                                    ->rows(3)
                                    ->maxLength(1000)
                                    ->helperText('Food allergies, drug allergies, environmental allergies'),
                            ]),
                            
                        Grid::make(2)
                            ->schema([
                                Textarea::make('medications')
                                    ->label('Current Medications')
                                    ->rows(3)
                                    ->maxLength(1000)
                                    ->helperText('List any medications you are currently taking'),
                                    
                                Textarea::make('dietary_restrictions')
                                    ->label('Dietary Restrictions')
                                    ->rows(3)
                                    ->maxLength(1000)
                                    ->helperText('Vegetarian, vegan, religious restrictions, etc.'),
                            ]),
                    ])
                    ->collapsible(),

                // Training Information Section (Read-only)
                Section::make('Training Information')
                    ->description('Your current training status (managed by academy)')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Placeholder::make('belt_level_display')
                                    ->label('Current Belt Level')
                                    ->content(fn (): string => $this->data['belt_level'] 
                                        ? $this->data['belt_level'] . ' Belt' 
                                        : 'Not assigned'),
                                        
                                Placeholder::make('active_batches')
                                    ->label('Active Batches')
                                    ->content(function (): string {
                                        $student = Auth::guard('student')->user();
                                        $batches = $student->activeBatches()->pluck('name')->toArray();
                                        return $batches ? implode(', ', $batches) : 'No active batches';
                                    }),
                            ]),
                    ])
                    ->collapsible(),
            ])
            ->statePath('data');
    }

    protected function getFormActions(): array
    {
        return [
            Action::make('save')
                ->label('Update Profile')
                ->icon('heroicon-m-check')
                ->submit('save'),
                
            Action::make('changePassword')
                ->label('Change Password')
                ->icon('heroicon-m-key')
                ->color('warning')
                ->form([
                    TextInput::make('current_password')
                        ->label('Current Password')
                        ->password()
                        ->required()
                        ->rules(['current_password:student']),
                        
                    TextInput::make('new_password')
                        ->label('New Password')
                        ->password()
                        ->required()
                        ->minLength(6)
                        ->confirmed()
                        ->revealable(),
                        
                    TextInput::make('new_password_confirmation')
                        ->label('Confirm New Password')
                        ->password()
                        ->required()
                        ->revealable(),
                ])
                ->action(function (array $data): void {
                    $student = Auth::guard('student')->user();
                    $student->update([
                        'password' => Hash::make($data['new_password'])
                    ]);
                    
                    Notification::make()
                        ->success()
                        ->title('Password updated successfully!')
                        ->send();
                }),
        ];
    }

    public function save(): void
    {
        try {
            $data = $this->form->getState();
            
            /** @var \App\Models\Student $student */
            $student = Auth::guard('student')->user();
            
            // Remove non-updateable fields
            unset($data['student_id'], $data['enrollment_date'], $data['status'], $data['belt_level']);
            
            // Ensure string fields are properly handled
            $data['first_name'] = $this->getSafeString($data['first_name'] ?? '');
            $data['last_name'] = $this->getSafeString($data['last_name'] ?? '');
            
            $student->update($data);

            Notification::make()
                ->success()
                ->title('Profile updated successfully!')
                ->body('Your profile information has been saved.')
                ->send();
                
            // Refresh the data
            $this->mount();
            
        } catch (Halt $exception) {
            return;
        } catch (\Exception $e) {
            Notification::make()
                ->danger()
                ->title('Error updating profile')
                ->body('There was an error saving your profile. Please try again.')
                ->send();
        }
    }
}
