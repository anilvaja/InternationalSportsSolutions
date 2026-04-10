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
    
    protected static ?string $navigationLabel = 'Currency & Exchange';
    
    protected static ?string $navigationGroup = 'Settings';
    
    protected static ?int $navigationSort = 5;

    public ?array $data = [];

    public function mount(): void
    {
        // Handle reset parameter
        if (request()->has('reset') && request()->get('reset') == '1') {
            $this->resetToDefaults();
            // Redirect to the same page within academy panel without reset parameter
            redirect()->to(route('filament.academy.pages.currency-settings'));
            return;
        }
        
        $currentCurrency = CurrencyHelper::getAcademyCurrency();
        $exchangeRates = CurrencyHelper::getAcademyExchangeRates();
        
        $formData = [
            'default_currency' => $currentCurrency,
        ];
        
        // Add exchange rates to form data
        foreach ($exchangeRates as $currency => $rate) {
            $formData["rate_{$currency}"] = $rate;
        }
        
        $this->form->fill($formData);
    }

    public function form(Form $form): Form
    {
        $currentCurrency = CurrencyHelper::getAcademyCurrency();
        $allCurrencies = CurrencyHelper::getAllCurrencies();
        
        return $form
            ->schema([
                Section::make('Default Currency Settings')
                    ->description('Set your academy\'s primary currency for all transactions')
                    ->schema([
                        Select::make('default_currency')
                            ->label('Academy Currency')
                            ->options(CurrencyHelper::getCurrencyOptions())
                            ->default('INR')
                            ->required()
                            ->live()
                            ->helperText('This will be used for all fees, payments, and financial displays'),
                    ]),
                    
                Section::make('Exchange Rates')
                    ->description("Set exchange rates from {$allCurrencies[$currentCurrency]['name']} to other currencies")
                    ->schema($this->getExchangeRateFields())
                    ->columns(2),
                    
                Section::make('Currency Information')
                    ->description('Current currency details and formatting')
                    ->schema([
                        TextInput::make('current_symbol')
                            ->label('Currency Symbol')
                            ->default(CurrencyHelper::getAcademyCurrencySymbol())
                            ->disabled(),
                            
                        TextInput::make('sample_format')
                            ->label('Sample Format')
                            ->default(CurrencyHelper::format(1234.56))
                            ->disabled(),
                    ])
                    ->columns(2),
            ])
            ->statePath('data');
    }

    protected function getExchangeRateFields(): array
    {
        $currentCurrency = CurrencyHelper::getAcademyCurrency();
        $allCurrencies = CurrencyHelper::getAllCurrencies();
        $fields = [];
        
        foreach ($allCurrencies as $code => $details) {
            if ($code !== $currentCurrency) {
                $fields[] = TextInput::make("rate_{$code}")
                    ->label("1 {$allCurrencies[$currentCurrency]['code']} = ? {$details['code']}")
                    ->numeric()
                    ->step(0.0000000000000001) // 16 decimal places precision
                    ->helperText("Exchange rate with up to 16 decimal places precision. Example: 83.1234567890123456")
                    ->default(CurrencyHelper::getExchangeRate($currentCurrency, $code));
            }
        }
        
        return $fields;
    }

    public function save(): void
    {
        try {
            $data = $this->form->getState();
            
            // Update default currency
            Setting::set('default_currency', $data['default_currency']);
            
            // Update exchange rates
            $currentCurrency = $data['default_currency'];
            $allCurrencies = CurrencyHelper::getAllCurrencies();
            
            foreach ($allCurrencies as $code => $details) {
                if ($code !== $currentCurrency && isset($data["rate_{$code}"])) {
                    // Convert string to float with high precision
                    $rate = (float) $data["rate_{$code}"];
                    CurrencyHelper::setExchangeRate($currentCurrency, $code, $rate);
                }
            }

            Notification::make()
                ->success()
                ->title('Currency settings saved!')
                ->body('Currency and exchange rates have been updated successfully.')
                ->send();
                
            // Don't redirect, just refresh the form data
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
    
    public function resetToDefaults(): void
    {
        try {
            $currentCurrency = CurrencyHelper::getAcademyCurrency();
            $allCurrencies = CurrencyHelper::getAllCurrencies();
            
            // Reset all exchange rates to defaults
            foreach ($allCurrencies as $code => $details) {
                if ($code !== $currentCurrency) {
                    // Get default rate and set it
                    $defaultRate = CurrencyHelper::getDefaultExchangeRate($currentCurrency, $code);
                    CurrencyHelper::setExchangeRate($currentCurrency, $code, $defaultRate);
                }
            }
            
            Notification::make()
                ->success()
                ->title('Exchange rates reset!')
                ->body('All exchange rates have been reset to default values.')
                ->send();
                
        } catch (\Exception $e) {
            Notification::make()
                ->danger()
                ->title('Error!')
                ->body('Failed to reset exchange rates: ' . $e->getMessage())
                ->send();
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
