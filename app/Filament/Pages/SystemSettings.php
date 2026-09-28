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

use Filament\Forms\Components\Select;
use Filament\Forms\Set;

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
            'admin_theme_preset' => $settings['admin_theme_preset'] ?? Setting::get('admin_theme_preset', 'ocean'),
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
                                ->label('System Name')
                                ->required()
                                ->placeholder('e.g. International Sports Solutions')
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

                Section::make('Super Admin Theme & Gradient Presets (Admin Panel Only)')
                    ->description('Select a vibrant gradient theme preset or customize theme colors exclusively for the Super Admin Panel.')
                    ->schema([
                        Select::make('admin_theme_preset')
                            ->label('Gradient Theme Preset')
                            ->options([
                                'ocean' => '🌊 Ocean Breeze (Sky Blue & Cyan)',
                                'sunset' => '🌅 Sunset Crimson (Rose & Ruby)',
                                'midnight' => '🌌 Midnight Indigo (Indigo & Violet)',
                                'emerald' => '🌿 Emerald Glow (Emerald & Mint)',
                                'cyber' => '🔮 Cyberpunk Neon (Purple & Fuchsia)',
                                'amber' => '✨ Golden Amber (Amber & Gold)',
                                'custom' => '🎨 Custom Colors',
                            ])
                            ->default('ocean')
                            ->live()
                            ->afterStateUpdated(function ($state, Set $set) {
                                $presets = [
                                    'ocean' => ['primary' => '#0284c7', 'secondary' => '#0f172a'],
                                    'sunset' => ['primary' => '#e11d48', 'secondary' => '#111827'],
                                    'midnight' => ['primary' => '#4f46e5', 'secondary' => '#0f172a'],
                                    'emerald' => ['primary' => '#059669', 'secondary' => '#064e3b'],
                                    'cyber' => ['primary' => '#9333ea', 'secondary' => '#2e1065'],
                                    'amber' => ['primary' => '#d97706', 'secondary' => '#451a03'],
                                ];
                                if (isset($presets[$state])) {
                                    $set('primary_color', $presets[$state]['primary']);
                                    $set('secondary_color', $presets[$state]['secondary']);
                                }
                            }),

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
            ->body('Dynamic system name, logo, and theme colors have been applied.')
            ->success()
            ->send();
    }
}
