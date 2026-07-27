<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\ColorPicker;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Storage;

class SystemSettings extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static ?string $navigationLabel = 'System Settings';

    protected static ?string $title = 'System & UI Settings';

    protected static ?int $navigationSort = 99;

    protected static string $view = 'filament.pages.system-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $settings = Setting::getGroup('general');

        $this->form->fill([
            'system_name' => $settings['system_name'] ?? Setting::get('system_name', 'International Sports Solutions'),
            'system_logo' => $settings['system_logo'] ?? Setting::get('system_logo'),
            'primary_color' => $settings['primary_color'] ?? Setting::get('primary_color', '#0284c7'),
            'secondary_color' => $settings['secondary_color'] ?? Setting::get('secondary_color', '#0f172a'),
            'contact_email' => $settings['contact_email'] ?? Setting::get('contact_email', 'admin@solution.com'),
            'contact_phone' => $settings['contact_phone'] ?? Setting::get('contact_phone', '+1234567890'),
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Branding & System Identity')
                    ->description('Configure the dynamic system name, logo, and identity across all panels and landing pages.')
                    ->schema([
                        Grid::make(2)->schema([
                            TextInput::make('system_name')
                                ->label('System / Hospital Name')
                                ->required()
                                ->placeholder('e.g. International Sports Solutions / City Hospital')
                                ->maxLength(255),

                            FileUpload::make('system_logo')
                                ->label('System Logo')
                                ->image()
                                ->directory('logos')
                                ->visibility('public')
                                ->imageEditor()
                                ->helperText('Upload logo PNG/JPG/SVG to be displayed in headers, navigation, and landing pages.'),
                        ]),
                    ]),

                Section::make('Dynamic Theme & Accent Colors')
                    ->description('Customize the primary and secondary theme colors for the application interface.')
                    ->schema([
                        Grid::make(2)->schema([
                            ColorPicker::make('primary_color')
                                ->label('Primary Theme Color')
                                ->required()
                                ->default('#0284c7'),

                            ColorPicker::make('secondary_color')
                                ->label('Secondary Theme Color')
                                ->required()
                                ->default('#0f172a'),
                        ]),
                    ]),

                Section::make('Contact & Support Information')
                    ->schema([
                        Grid::make(2)->schema([
                            TextInput::make('contact_email')
                                ->label('Support Email')
                                ->email()
                                ->maxLength(255),

                            TextInput::make('contact_phone')
                                ->label('Support Phone')
                                ->tel()
                                ->maxLength(20),
                        ]),
                    ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $state = $this->form->getState();

        foreach ($state as $key => $value) {
            Setting::set($key, $value, 'string', 'general');
        }

        Setting::clearCache();

        Notification::make()
            ->title('System settings updated successfully')
            ->body('Dynamic Hospital/System name, logo, and theme colors have been applied.')
            ->success()
            ->send();
    }
}
