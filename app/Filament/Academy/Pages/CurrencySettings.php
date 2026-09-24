<?php

namespace App\Filament\Academy\Pages;

use Filament\Pages\Page;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Placeholder;
use Filament\Support\Exceptions\Halt;
use Illuminate\Support\Facades\Auth;
use App\Support\CurrencyHelper;
use App\Models\Setting;
use Filament\Notifications\Notification;

class CurrencySettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-currency-dollar';
    
    protected static string $view = 'filament.academy.pages.currency-settings';
    
    protected static ?string $navigationLabel = 'Currency & Timezone Settings';
    
    protected static ?string $navigationGroup = 'Settings';
    
    protected static ?int $navigationSort = 5;

    public ?array $data = [];

    public function mount(): void
    {
        $currentCurrency = Setting::get('default_currency', 'INR');
        $currencyName = Setting::get('currency_name', CurrencyHelper::getAcademyCurrencyName());
        $currencySymbol = Setting::get('currency_symbol', CurrencyHelper::getAcademyCurrencySymbol());
        $timezone = Setting::get('timezone', 'Asia/Kolkata');

        $this->form->fill([
            'default_currency' => $currentCurrency,
            'currency_name' => $currencyName,
            'currency_symbol' => $currencySymbol,
            'timezone' => $timezone,
        ]);
    }

    public static function getTimezoneOptions(): array
    {
        $identifiers = \DateTimeZone::listIdentifiers();
        $options = [];
        $now = new \DateTime('now', new \DateTimeZone('UTC'));

        $popularMapping = [
            'Asia/Kolkata' => 'India (IST)',
            'Asia/Dubai' => 'UAE / Gulf (GST)',
            'Asia/Riyadh' => 'Saudi Arabia (AST)',
            'Asia/Qatar' => 'Qatar',
            'Asia/Muscat' => 'Oman',
            'Asia/Kuwait' => 'Kuwait',
            'Asia/Bahrain' => 'Bahrain',
            'Asia/Singapore' => 'Singapore (SGT)',
            'Asia/Bangkok' => 'Thailand',
            'Asia/Tokyo' => 'Japan (JST)',
            'Asia/Dhaka' => 'Bangladesh',
            'Asia/Colombo' => 'Sri Lanka',
            'Asia/Karachi' => 'Pakistan',
            'Europe/London' => 'United Kingdom (GMT/BST)',
            'Europe/Paris' => 'France / Central Europe',
            'Europe/Berlin' => 'Germany',
            'America/New_York' => 'USA (Eastern)',
            'America/Chicago' => 'USA (Central)',
            'America/Los_Angeles' => 'USA (Pacific)',
            'America/Toronto' => 'Canada (Eastern)',
            'Australia/Sydney' => 'Australia (Sydney)',
            'Pacific/Auckland' => 'New Zealand',
        ];

        foreach ($identifiers as $tz) {
            try {
                $zone = new \DateTimeZone($tz);
                $offset = $zone->getOffset($now);
                $hours = sprintf('%+03d:%02d', intval($offset / 3600), abs(intval($offset % 3600 / 60)));
                $country = $popularMapping[$tz] ?? null;
                $suffix = $country ? " — {$country}" : '';
                $options[$tz] = str_replace('_', ' ', $tz) . " (UTC{$hours}){$suffix}";
            } catch (\Exception $e) {
                $options[$tz] = $tz;
            }
        }

        return $options;
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Academy Currency Settings')
                    ->description('Set your academy\'s primary currency name and icon/symbol for display across fees, payroll, and receipts.')
                    ->schema([
                        Select::make('default_currency')
                            ->label('Standard Currency Preset')
                            ->options(CurrencyHelper::getCurrencyOptions())
                            ->reactive()
                            ->afterStateUpdated(function (callable $set, $state) {
                                $allCurrencies = CurrencyHelper::getAllCurrencies();
                                if (isset($allCurrencies[$state])) {
                                    $set('currency_name', $allCurrencies[$state]['name']);
                                    $set('currency_symbol', $allCurrencies[$state]['symbol']);
                                }
                            })
                            ->helperText('Selecting a preset will populate the standard name and icon/symbol below.'),

                        Grid::make(2)
                            ->schema([
                                TextInput::make('currency_name')
                                    ->label('Currency Name')
                                    ->placeholder('e.g., Indian Rupee, US Dollar, Euro')
                                    ->required()
                                    ->live()
                                    ->helperText('Full name of your currency'),

                                TextInput::make('currency_symbol')
                                    ->label('Currency Icon / Symbol')
                                    ->placeholder('e.g., ₹, $, €, £, AED')
                                    ->required()
                                    ->live()
                                    ->helperText('Icon or symbol placed before financial amounts'),
                            ]),
                    ]),

                Section::make('Academy Timezone Settings')
                    ->description('Select your local country/city timezone for class schedules, attendance logs, and system timestamps.')
                    ->schema([
                        Select::make('timezone')
                            ->label('Academy Timezone')
                            ->options(static::getTimezoneOptions())
                            ->default('Asia/Kolkata')
                            ->searchable()
                            ->required()
                            ->live()
                            ->helperText('Searchable list of timezones (e.g. Asia/Kolkata - India, America/New_York - USA, Asia/Dubai - UAE)'),

                        Placeholder::make('current_time_preview')
                            ->label('Current Academy Local Time')
                            ->content(function ($get) {
                                $tz = $get('timezone') ?: 'Asia/Kolkata';
                                try {
                                    return \Carbon\Carbon::now($tz)->format('d/m/Y h:i:s A (T)');
                                } catch (\Exception $e) {
                                    return \Carbon\Carbon::now('Asia/Kolkata')->format('d/m/Y h:i:s A (T)');
                                }
                            }),
                    ]),

                Section::make('Display Preview')
                    ->description('Live preview of how prices and fees will appear across the system')
                    ->schema([
                        Placeholder::make('sample_format')
                            ->label('Sample Price Display')
                            ->content(function ($get) {
                                $symbol = $get('currency_symbol') ?: '₹';
                                return $symbol . ' 5,000.00';
                            }),
                    ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        try {
            $data = $this->form->getState();
            
            if (!empty($data['default_currency'])) {
                Setting::set('default_currency', $data['default_currency']);
            }
            if (!empty($data['currency_name'])) {
                Setting::set('currency_name', $data['currency_name']);
            }
            if (!empty($data['currency_symbol'])) {
                Setting::set('currency_symbol', $data['currency_symbol']);
            }
            if (!empty($data['timezone'])) {
                Setting::set('timezone', $data['timezone']);
            }

            Notification::make()
                ->success()
                ->title('Currency & Timezone Settings saved!')
                ->body('Currency name, icon/symbol, and academy timezone updated successfully.')
                ->send();
                
            $this->mount();
                
        } catch (Halt $exception) {
            return;
        } catch (\Exception $e) {
            Notification::make()
                ->danger()
                ->title('Error!')
                ->body('Failed to save settings: ' . $e->getMessage())
                ->send();
        }
    }

    public static function canAccess(): bool
    {
        $user = Auth::user();
        if ($user && $user->is_super_admin) {
            return true;
        }
        if (!$user || !$user->academy_id) {
            return false;
        }
        return \App\Models\UserAcademyRole::where('user_id', $user->id)
            ->whereHas('academyRole', function ($query) use ($user) {
                $query->where('name', 'admin')
                      ->where('academy_id', $user->academy_id);
            })
            ->where('is_active', true)
            ->exists();
    }
}
