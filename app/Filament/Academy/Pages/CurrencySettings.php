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
    
    protected static ?string $navigationLabel = 'Currency Settings';
    
    protected static ?string $navigationGroup = 'Settings';
    
    protected static ?int $navigationSort = 5;

    public ?array $data = [];

    public function mount(): void
    {
        $currentCurrency = Setting::get('default_currency', 'INR');
        $currencyName = Setting::get('currency_name', CurrencyHelper::getAcademyCurrencyName());
        $currencySymbol = Setting::get('currency_symbol', CurrencyHelper::getAcademyCurrencySymbol());

        $this->form->fill([
            'default_currency' => $currentCurrency,
            'currency_name' => $currencyName,
            'currency_symbol' => $currencySymbol,
        ]);
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

            Notification::make()
                ->success()
                ->title('Currency settings saved!')
                ->body('Currency name and icon/symbol updated successfully.')
                ->send();
                
            $this->mount();
                
        } catch (Halt $exception) {
            return;
        } catch (\Exception $e) {
            Notification::make()
                ->danger()
                ->title('Error!')
                ->body('Failed to save currency settings: ' . $e->getMessage())
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
