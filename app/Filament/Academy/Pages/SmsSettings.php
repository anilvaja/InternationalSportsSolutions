<?php

namespace App\Filament\Academy\Pages;

use App\Models\Setting;
use App\Services\SmsService;
use Filament\Forms\Form;
use Filament\Pages\Page;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Components\Textarea;
use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Auth;

class SmsSettings extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-device-phone-mobile';
    protected static ?string $navigationGroup = 'Settings';
    protected static ?string $navigationLabel = 'SMS Settings';
    protected static ?int $navigationSort = 3;
    protected static string $view = 'filament.pages.sms-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->loadSmsSettings();
    }

    protected function loadSmsSettings(): void
    {
        $this->data = [
            'sms_enabled' => Setting::get('sms_enabled', false),
            'sms_provider' => Setting::get('sms_provider', 'textlocal'),
            'sms_api_key' => Setting::get('sms_api_key', ''),
            'sms_api_url' => Setting::get('sms_api_url', 'https://api.textlocal.in/send/'),
            'sms_sender_id' => Setting::get('sms_sender_id', 'ACADEMY'),
            'sms_test_number' => Setting::get('sms_test_number', ''),
            'sms_country_code' => Setting::get('sms_country_code', '91'),
        ];
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('SMS Configuration')
                    ->description('Configure SMS settings for sending notifications')
                    ->schema([
                        Toggle::make('sms_enabled')
                            ->label('Enable SMS Notifications')
                            ->default(false)
                            ->helperText('Toggle to enable or disable SMS functionality')
                            ->live(),

                        Select::make('sms_provider')
                            ->label('SMS Provider')
                            ->required()
                            ->options([
                                'textlocal' => 'TextLocal (India)',
                                'twilio' => 'Twilio (Global)',
                                'msg91' => 'MSG91 (India)',
                                'custom' => 'Custom API',
                            ])
                            ->default('textlocal')
                            ->live()
                            ->helperText('Choose your SMS service provider')
                            ->visible(fn ($get) => $get('sms_enabled')),

                        TextInput::make('sms_api_key')
                            ->label('API Key')
                            ->password()
                            ->required()
                            ->placeholder('Your SMS API key')
                            ->helperText('API key provided by your SMS service provider')
                            ->visible(fn ($get) => $get('sms_enabled')),

                        TextInput::make('sms_api_url')
                            ->label('API URL')
                            ->required()
                            ->url()
                            ->placeholder('https://api.textlocal.in/send/')
                            ->helperText('API endpoint URL for sending SMS')
                            ->visible(fn ($get) => $get('sms_enabled')),

                        TextInput::make('sms_sender_id')
                            ->label('Sender ID')
                            ->required()
                            ->maxLength(6)
                            ->placeholder('ACADEMY')
                            ->helperText('6-character sender ID (alphabetic only)')
                            ->visible(fn ($get) => $get('sms_enabled')),

                        TextInput::make('sms_country_code')
                            ->label('Default Country Code')
                            ->required()
                            ->placeholder('91')
                            ->helperText('Default country code (without +)')
                            ->visible(fn ($get) => $get('sms_enabled')),
                    ])
                    ->columns(2),

                Section::make('SMS Templates')
                    ->description('Configure SMS message templates')
                    ->schema([
                        Textarea::make('absence_sms_template')
                            ->label('Absence Notification Template')
                            ->rows(3)
                            ->placeholder('Dear Parent, {student_name} has been absent from {batch_name} for {absence_count} consecutive sessions. Please ensure regular attendance. - {academy_name}')
                            ->helperText('Available variables: {student_name}, {batch_name}, {absence_count}, {academy_name}')
                            ->visible(fn ($get) => $get('sms_enabled')),

                        Textarea::make('overdue_sms_template')
                            ->label('Overdue Fee Notification Template')
                            ->rows(3)
                            ->placeholder('Dear {student_name}, your fee payment of {amount} is overdue by {days} days. Due date: {due_date}. Please make payment immediately. - {academy_name}')
                            ->helperText('Available variables: {student_name}, {amount}, {days}, {due_date}, {academy_name}')
                            ->visible(fn ($get) => $get('sms_enabled')),
                    ])
                    ->collapsible()
                    ->collapsed()
                    ->visible(fn ($get) => $get('sms_enabled')),

                Section::make('Test Configuration')
                    ->description('Test SMS functionality')
                    ->schema([
                        TextInput::make('sms_test_number')
                            ->label('Test Phone Number')
                            ->tel()
                            ->placeholder('9876543210')
                            ->helperText('Phone number to send test SMS (without country code)')
                            ->visible(fn ($get) => $get('sms_enabled')),
                    ])
                    ->visible(fn ($get) => $get('sms_enabled')),
            ])
            ->statePath('data');
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('save')
                ->label('Save SMS Settings')
                ->action('saveSmsSettings')
                ->icon('heroicon-o-check')
                ->color('success'),

            Action::make('test_sms')
                ->label('Send Test SMS')
                ->action('sendTestSms')
                ->icon('heroicon-o-paper-airplane')
                ->color('warning')
                ->requiresConfirmation()
                ->modalHeading('Send Test SMS')
                ->modalDescription('This will send a test SMS to verify your SMS configuration.')
                ->modalSubmitActionLabel('Send Test SMS')
                ->visible(fn () => $this->data['sms_enabled'] ?? false),
        ];
    }

    public function saveSmsSettings(): void
    {
        $data = $this->form->getState();

        // Save SMS settings with encryption for API key
        Setting::set('sms_enabled', $data['sms_enabled'], 'boolean', 'sms');
        Setting::set('sms_provider', $data['sms_provider'], 'string', 'sms');
        Setting::set('sms_api_key', $data['sms_api_key'], 'string', 'sms', true); // encrypted
        Setting::set('sms_api_url', $data['sms_api_url'], 'string', 'sms');
        Setting::set('sms_sender_id', $data['sms_sender_id'], 'string', 'sms');
        Setting::set('sms_test_number', $data['sms_test_number'], 'string', 'sms');
        Setting::set('sms_country_code', $data['sms_country_code'], 'string', 'sms');

        // Save templates if provided
        if (isset($data['absence_sms_template'])) {
            Setting::set('absence_sms_template', $data['absence_sms_template'], 'string', 'sms');
        }
        if (isset($data['overdue_sms_template'])) {
            Setting::set('overdue_sms_template', $data['overdue_sms_template'], 'string', 'sms');
        }

        Notification::make()
            ->title('SMS Settings Saved')
            ->body('SMS configuration has been saved successfully.')
            ->success()
            ->send();
    }

    public function sendTestSms(): void
    {
        try {
            $data = $this->form->getState();
            
            if (!$data['sms_enabled']) {
                throw new \Exception('SMS is not enabled');
            }

            if (empty($data['sms_test_number'])) {
                throw new \Exception('Please provide a test phone number');
            }

            // Create SMS service instance with current settings
            $smsService = new SmsService();
            
            $testMessage = "This is a test SMS from your academy management system. SMS configuration is working correctly! Sent at: " . now()->format('Y-m-d H:i:s');
            
            $result = $smsService->send($data['sms_test_number'], $testMessage);

            if ($result['success']) {
                Notification::make()
                    ->title('Test SMS Sent')
                    ->body('Test SMS has been sent successfully to +' . $data['sms_country_code'] . $data['sms_test_number'])
                    ->success()
                    ->send();
            } else {
                throw new \Exception($result['error'] ?? 'Unknown error');
            }

        } catch (\Exception $e) {
            Notification::make()
                ->title('Test SMS Failed')
                ->body('Failed to send test SMS: ' . $e->getMessage())
                ->danger()
                ->send();
        }
    }

    public function getProviderInstructions(): string
    {
        $provider = $this->data['sms_provider'] ?? 'textlocal';

        return match($provider) {
            'textlocal' => 'TextLocal India: Get API key from textlocal.in dashboard. Use sender ID format: 6 letters (e.g., ACADEMY)',
            'twilio' => 'Twilio: Get Account SID and Auth Token from twilio.com console',
            'msg91' => 'MSG91: Get API key from msg91.com dashboard',
            'custom' => 'Custom API: Ensure your API endpoint accepts POST requests with required parameters',
            default => 'Please select a provider for specific instructions',
        };
    }
    
    public static function canAccess(): bool
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        
        // Allow super admin to access
        if ($user && $user->is_super_admin) {
            return true;
        }
        
        // Only allow academy admins (users with 'admin' role in their academy)
        if (!$user || !$user->academy_id) {
            return false;
        }
        
        // Check if user has admin role in their academy
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
