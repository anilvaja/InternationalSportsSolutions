<?php

namespace App\Filament\Academy\Pages;

use Filament\Pages\Page;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Placeholder;
use Filament\Actions\Action;
use Filament\Support\Exceptions\Halt;
use Illuminate\Support\Facades\Auth;
use App\Models\Academy;
use App\Models\Setting;
use App\Models\AcademyRole;
use Filament\Notifications\Notification;
use App\Support\CurrencyHelper;

class AcademySettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-building-office';
    
    protected static string $view = 'filament.academy.pages.academy-settings';
    
    protected static ?string $navigationLabel = 'Academy Settings';
    
    protected static ?string $navigationGroup = 'ADMINISTRATION';
    
    protected static ?int $navigationSort = 3;

    public ?array $data = [];

    public function mount(): void
    {
        $academy = Auth::user()->academy;
        if (!$academy) {
            Notification::make()
                ->title('No Academy Context')
                ->body('Your user account is not associated with an academy context.')
                ->danger()
                ->send();
            
            $this->redirect(Auth::user()->is_super_admin ? '/admin' : '/');
            return;
        }
        $academyData = $academy->toArray();
        
        // Add settings data
        $academyData['academy_name'] = Setting::get('academy_name', $academy->name);
        $academyData['academy_contact'] = Setting::get('academy_contact', $academy->contact_phone);
        $academyData['default_currency'] = Setting::get('default_currency', 'INR');
        $academyData['timezone'] = Setting::get('timezone', 'Asia/Kolkata');
        $academyData['fee_reminder_days'] = Setting::get('fee_reminder_days', 7);
        $academyData['absence_alert_days'] = Setting::get('absence_alert_days', 3);
        $academyData['auto_notifications'] = Setting::get('auto_notifications', true);
        
        // Format subscription dates for display
        if ($academy->subscription_starts_at) {
            $academyData['subscription_starts_at'] = $academy->subscription_starts_at->format('Y-m-d');
        }
        if ($academy->subscription_ends_at) {
            $academyData['subscription_ends_at'] = $academy->subscription_ends_at->format('Y-m-d');
        }
        
        $this->form->fill($academyData);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Academy Information')
                    ->schema([
                        FileUpload::make('logo')
                            ->label('Academy Logo')
                            ->image()
                            ->directory('academy-logos')
                            ->visibility('public')
                            ->maxSize(2048)
                            ->helperText('Upload academy logo (max 2MB)'),
                            
                        FileUpload::make('icon')
                            ->label('Academy Icon')
                            ->image()
                            ->directory('academy-icons')
                            ->visibility('public')
                            ->maxSize(1024)
                            ->helperText('Upload academy icon for title bar (max 1MB, recommended: 32x32px)'),
                            
                        TextInput::make('name')
                            ->required()
                            ->maxLength(255)
                            ->label('Academy Name'),
                            
                        TextInput::make('academy_name')
                            ->label('Display Name')
                            ->helperText('Name used in notifications and communications')
                            ->maxLength(255),
                            
                        Textarea::make('description')
                            ->maxLength(1000),
                            
                        TextInput::make('contact_email')
                            ->email()
                            ->maxLength(255),
                            
                        TextInput::make('contact_phone')
                            ->tel()
                            ->maxLength(20),
                            
                        TextInput::make('academy_contact')
                            ->label('Support Contact')
                            ->helperText('Contact information shown in notifications')
                            ->maxLength(255),
                            
                        TextInput::make('address')
                            ->maxLength(500),
                    ]),
                    
                Section::make('System Settings')
                    ->schema([
                        Select::make('default_currency')
                            ->options(CurrencyHelper::getCurrencyOptions())
                            ->default('INR')
                            ->helperText('This currency will be used throughout your academy'),
                            
                        Select::make('timezone')
                            ->options([
                                'Asia/Kolkata' => 'Asia/Kolkata (IST)',
                                'Asia/Dubai' => 'Asia/Dubai (GST)',
                                'Europe/London' => 'Europe/London (GMT)',
                                'America/New_York' => 'America/New_York (EST)',
                            ])
                            ->default('Asia/Kolkata'),
                    ]),
                    
                Section::make('Notification Settings')
                    ->schema([
                        Toggle::make('auto_notifications')
                            ->label('Enable Automatic Notifications')
                            ->helperText('Send automated email/SMS notifications for fees and attendance'),
                            
                        TextInput::make('fee_reminder_days')
                            ->numeric()
                            ->label('Fee Reminder Days')
                            ->helperText('Days before fee due date to send reminder')
                            ->default(7)
                            ->minValue(1)
                            ->maxValue(30),
                            
                        TextInput::make('absence_alert_days')
                            ->numeric()
                            ->label('Absence Alert Days')
                            ->helperText('Consecutive absence days before sending alert')
                            ->default(3)
                            ->minValue(1)
                            ->maxValue(10),
                    ]),
                    
                Section::make('Subscription & Limits')
                    ->description('Academy subscription details and usage limits (Admin Only)')
                    ->schema([
                        Placeholder::make('usage_summary')
                            ->label('Usage Summary')
                            ->content(function () {
                                $academy = Auth::user()->academy;
                                $currentUsers = $academy->users()->count();
                                $currentStudents = \App\Models\Student::where('academy_id', $academy->id)->count();
                                $currentBranches = \App\Models\Branch::where('academy_id', $academy->id)->where('status', 'active')->count();
                                $currentCoaches = $academy->users()->where('role', 'coach')->count();
                                
                                $usersPercent = $academy->max_users ? round(($currentUsers / $academy->max_users) * 100, 1) : 0;
                                $studentsPercent = $academy->max_students ? round(($currentStudents / $academy->max_students) * 100, 1) : 0;
                                $branchesPercent = $academy->max_branches ? round(($currentBranches / $academy->max_branches) * 100, 1) : 0;
                                $coachesPercent = $academy->max_coaches ? round(($currentCoaches / $academy->max_coaches) * 100, 1) : 0;
                                
                                return view('filament.components.usage-summary', [
                                    'users' => ['current' => $currentUsers, 'max' => $academy->max_users, 'percent' => $usersPercent],
                                    'students' => ['current' => $currentStudents, 'max' => $academy->max_students, 'percent' => $studentsPercent],
                                    'branches' => ['current' => $currentBranches, 'max' => $academy->max_branches, 'percent' => $branchesPercent],
                                    'coaches' => ['current' => $currentCoaches, 'max' => $academy->max_coaches, 'percent' => $coachesPercent],
                                ]);
                            })
                            ->columnSpanFull(),
                            
                        TextInput::make('max_users')
                            ->numeric()
                            ->label('Max Users')
                            ->helperText('Maximum number of users allowed')
                            ->disabled()
                            ->suffix(function () {
                                $academy = Auth::user()->academy;
                                $currentUsers = $academy->users()->count();
                                return "({$currentUsers} used)";
                            }),
                            
                        TextInput::make('max_students')
                            ->numeric()
                            ->label('Max Students')
                            ->helperText('Maximum number of students allowed')
                            ->disabled()
                            ->suffix(function () {
                                $academy = Auth::user()->academy;
                                $currentStudents = \App\Models\Student::where('academy_id', $academy->id)->count();
                                return "({$currentStudents} used)";
                            }),
                            
                        TextInput::make('max_branches')
                            ->numeric()
                            ->label('Max Branches')
                            ->helperText('Maximum number of branches allowed')
                            ->disabled()
                            ->suffix(function () {
                                $academy = Auth::user()->academy;
                                $currentBranches = \App\Models\Branch::where('academy_id', $academy->id)->where('status', 'active')->count();
                                return "({$currentBranches} used)";
                            }),
                            
                        TextInput::make('max_coaches')
                            ->numeric()
                            ->label('Max Coaches')
                            ->helperText('Maximum number of coaches allowed')
                            ->disabled()
                            ->suffix(function () {
                                $academy = Auth::user()->academy;
                                $currentCoaches = $academy->users()->where('role', 'coach')->count();
                                return "({$currentCoaches} used)";
                            }),
                            
                        TextInput::make('subscription_starts_at')
                            ->label('Subscription Starts At')
                            ->type('date')
                            ->disabled()
                            ->helperText('When your current subscription started'),
                            
                        TextInput::make('subscription_ends_at')
                            ->label('Subscription Ends At')
                            ->type('date')
                            ->disabled()
                            ->helperText('When your current subscription expires')
                            ->extraAttributes(function () {
                                $academy = Auth::user()->academy;
                                $isExpired = $academy->subscription_ends_at && $academy->subscription_ends_at->isPast();
                                return $isExpired ? ['style' => 'color: #ef4444; font-weight: bold;'] : [];
                            }),
                    ])
                    ->collapsible(),
            ])
            ->statePath('data');
    }

    protected function getFormActions(): array
    {
        return [
            Action::make('save')
                ->label(__('filament-panels::pages/auth/edit-profile.form.actions.save.label'))
                ->submit('save'),
        ];
    }

    public function save(): void
    {
        try {
            $data = $this->form->getState();
            
            $academy = Auth::user()->academy;
            
            // Update academy information
            $updateData = [
                'name' => $data['name'],
                'description' => $data['description'],
                'contact_email' => $data['contact_email'],
                'contact_phone' => $data['contact_phone'],
                'address' => $data['address'],
            ];
            
            // Handle file uploads
            if (isset($data['logo'])) {
                $updateData['logo'] = $data['logo'];
            }
            if (isset($data['icon'])) {
                $updateData['icon'] = $data['icon'];
            }
            
            $academy->update($updateData);

            // Update settings
            Setting::set('academy_name', $data['academy_name']);
            Setting::set('academy_contact', $data['academy_contact']);
            Setting::set('default_currency', $data['default_currency']);
            Setting::set('timezone', $data['timezone']);
            Setting::set('fee_reminder_days', $data['fee_reminder_days']);
            Setting::set('absence_alert_days', $data['absence_alert_days']);
            Setting::set('auto_notifications', $data['auto_notifications']);

            Notification::make()
                ->success()
                ->title('Academy settings saved successfully!')
                ->body('All settings have been updated.')
                ->send();
                
        } catch (Halt $exception) {
            return;
        }
    }
    
    public static function canAccess(): bool
    {
        $user = Auth::user();
        
        // Allow super admin to access
        if ($user && $user->is_super_admin) {
            return true;
        }
        
        // Only allow academy admins
        if (!$user || !$user->academy_id) {
            return false;
        }
        
        // Check if user is academy_admin by role field
        if ($user->role === 'academy_admin') {
            return true;
        }
        
        // Check if user has admin role in their academy using direct query
        $hasAdminRole = \App\Models\UserAcademyRole::where('user_id', $user->id)
            ->whereHas('academyRole', function ($query) use ($user) {
                $query->where('name', 'admin')
                      ->where('academy_id', $user->academy_id);
            })
            ->where('is_active', true)
            ->exists();
            
        return $hasAdminRole;
    }
}
