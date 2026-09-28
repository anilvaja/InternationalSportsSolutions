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

                Section::make('Super Admin Theme Presets (Admin Panel Only)')
                    ->description('Select a theme preset for the Super Admin Panel. The chosen theme automatically styles the side menu background, content background, and accent colors.')
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
                            ])
                            ->default('ocean')
                            ->required(),
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
