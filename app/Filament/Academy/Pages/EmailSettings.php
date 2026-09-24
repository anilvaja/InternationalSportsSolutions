<?php

namespace App\Filament\Academy\Pages;

use App\Models\Setting;
use Filament\Forms\Form;
use Filament\Pages\Page;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Select;
use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Auth;

class EmailSettings extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-envelope';
    protected static ?string $navigationGroup = 'ADMINISTRATION';
    protected static ?string $navigationLabel = 'Email Settings';
    protected static ?int $navigationSort = 5;
    protected static string $view = 'filament.pages.email-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->loadEmailSettings();
    }

    protected function loadEmailSettings(): void
    {
        $this->data = [
            'mail_driver' => Setting::get('mail_driver', config('mail.default', 'smtp')),
            'mail_host' => Setting::get('mail_host', config('mail.mailers.smtp.host', 'smtp.gmail.com')),
            'mail_port' => Setting::get('mail_port', config('mail.mailers.smtp.port', 587)),
            'mail_username' => Setting::get('mail_username', config('mail.mailers.smtp.username', '')),
            'mail_password' => Setting::get('mail_password', ''),
            'mail_encryption' => Setting::get('mail_encryption', config('mail.mailers.smtp.encryption', 'tls')),
            'mail_from_address' => Setting::get('mail_from_address', config('mail.from.address', '')),
            'mail_from_name' => Setting::get('mail_from_name', config('mail.from.name', '')),
        ];
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Email Configuration')
                    ->description('Configure email settings for sending notifications and communications')
                    ->schema([
                        Select::make('mail_driver')
                            ->label('Mail Driver')
                            ->required()
                            ->options([
                                'smtp' => 'SMTP',
                                'sendmail' => 'Sendmail',
                                'mailgun' => 'Mailgun',
                                'ses' => 'Amazon SES',
                            ])
                            ->default('smtp')
                            ->live()
                            ->helperText('Choose your email service provider'),

                        TextInput::make('mail_host')
                            ->label('SMTP Host')
                            ->required()
                            ->placeholder('smtp.gmail.com')
                            ->helperText('SMTP server hostname')
                            ->visible(fn ($get) => $get('mail_driver') === 'smtp'),

                        TextInput::make('mail_port')
                            ->label('SMTP Port')
                            ->required()
                            ->numeric()
                            ->placeholder('587')
                            ->helperText('Common ports: 587 (TLS), 465 (SSL), 25 (Non-secure)')
                            ->visible(fn ($get) => $get('mail_driver') === 'smtp'),

                        Select::make('mail_encryption')
                            ->label('Encryption')
                            ->required()
                            ->options([
                                'tls' => 'TLS (Recommended)',
                                'ssl' => 'SSL',
                                'none' => 'None',
                            ])
                            ->default('tls')
                            ->helperText('Encryption method for secure email transmission')
                            ->visible(fn ($get) => $get('mail_driver') === 'smtp'),

                        TextInput::make('mail_username')
                            ->label('SMTP Username')
                            ->required()
                            ->placeholder('your-email@gmail.com')
                            ->helperText('Your email address or SMTP username')
                            ->visible(fn ($get) => $get('mail_driver') === 'smtp'),

                        TextInput::make('mail_password')
                            ->label('SMTP Password')
                            ->password()
                            ->required()
                            ->placeholder('Your app password')
                            ->helperText('For Gmail, use an App Password instead of your regular password')
                            ->visible(fn ($get) => $get('mail_driver') === 'smtp'),

                        TextInput::make('mail_from_address')
                            ->label('From Email Address')
                            ->email()
                            ->required()
                            ->placeholder('noreply@academy.com')
                            ->helperText('Email address that appears as sender'),

                        TextInput::make('mail_from_name')
                            ->label('From Name')
                            ->required()
                            ->placeholder('Academy Name')
                            ->helperText('Name that appears as sender'),
                    ])
                    ->columns(2),

                Section::make('Email Templates')
                    ->description('Email template settings')
                    ->schema([
                        TextInput::make('email_footer_text')
                            ->label('Footer Text')
                            ->placeholder('Thank you for choosing our academy')
                            ->helperText('Text to appear in email footers'),

                        TextInput::make('email_support_contact')
                            ->label('Support Contact')
                            ->email()
                            ->placeholder('support@academy.com')
                            ->helperText('Support email for email replies'),
                    ])
                    ->collapsible()
                    ->collapsed(),
            ])
            ->statePath('data');
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('save')
                ->label('Save Email Settings')
                ->action('saveEmailSettings')
                ->icon('heroicon-o-check')
                ->color('success'),

            Action::make('test_email')
                ->label('Send Test Email')
                ->action('sendTestEmail')
                ->icon('heroicon-o-paper-airplane')
                ->color('info')
                ->requiresConfirmation()
                ->modalHeading('Send Test Email')
                ->modalDescription('This will send a test email to verify your email configuration.')
                ->modalSubmitActionLabel('Send Test Email'),
        ];
    }

    public function saveEmailSettings(): void
    {
        $data = $this->form->getState();

        // Save email settings with encryption for sensitive data
        Setting::set('mail_driver', $data['mail_driver'], 'string', 'email');
        Setting::set('mail_host', $data['mail_host'], 'string', 'email');
        Setting::set('mail_port', $data['mail_port'], 'integer', 'email');
        Setting::set('mail_username', $data['mail_username'], 'string', 'email', true); // encrypted
        Setting::set('mail_password', $data['mail_password'], 'string', 'email', true); // encrypted
        Setting::set('mail_encryption', $data['mail_encryption'], 'string', 'email');
        Setting::set('mail_from_address', $data['mail_from_address'], 'string', 'email');
        Setting::set('mail_from_name', $data['mail_from_name'], 'string', 'email');

        // Update runtime configuration
        $this->updateMailConfig();

        Notification::make()
            ->title('Email Settings Saved')
            ->body('Email configuration has been saved successfully.')
            ->success()
            ->send();
    }

    public function sendTestEmail(): void
    {
        try {
            $data = $this->form->getState();
            
            // Update mail configuration temporarily
            $this->updateMailConfig();

            // Send test email
            Mail::raw(
                "This is a test email from your academy management system.\n\nEmail configuration is working correctly!\n\nSent at: " . now()->format('Y-m-d H:i:s'),
                function ($message) use ($data) {
                    $message->to($data['mail_from_address'])
                           ->subject('Test Email - Academy Management System')
                           ->from($data['mail_from_address'], $data['mail_from_name']);
                }
            );

            Notification::make()
                ->title('Test Email Sent')
                ->body('Test email has been sent successfully to ' . $data['mail_from_address'])
                ->success()
                ->send();

        } catch (\Exception $e) {
            Notification::make()
                ->title('Test Email Failed')
                ->body('Failed to send test email: ' . $e->getMessage())
                ->danger()
                ->send();
        }
    }

    private function updateMailConfig(): void
    {
        $settings = Setting::getGroup('email');

        if (!empty($settings)) {
            Config::set([
                'mail.default' => $settings['mail_driver'] ?? 'smtp',
                'mail.mailers.smtp.host' => $settings['mail_host'] ?? 'smtp.gmail.com',
                'mail.mailers.smtp.port' => $settings['mail_port'] ?? 587,
                'mail.mailers.smtp.encryption' => $settings['mail_encryption'] ?? 'tls',
                'mail.mailers.smtp.username' => $settings['mail_username'] ?? '',
                'mail.mailers.smtp.password' => $settings['mail_password'] ?? '',
                'mail.from.address' => $settings['mail_from_address'] ?? '',
                'mail.from.name' => $settings['mail_from_name'] ?? '',
            ]);
        }
    }
    
    public static function canAccess(): bool
    {
        $user = Auth::user();
        
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
