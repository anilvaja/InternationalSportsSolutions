<x-filament-panels::page>
    <x-filament::section>
        <x-slot name="heading">
            Currency & Exchange Rate Management
        </x-slot>
        
        <x-slot name="description">
            Configure your academy's currency settings and exchange rates for international transactions.
        </x-slot>

        <form wire:submit="save">
            {{ $this->form }}
            
            <div class="mt-6 flex gap-3">
                <x-filament::button type="submit">
                    Save Currency Settings
                </x-filament::button>
                
                <x-filament::button 
                    color="gray" 
                    type="button"
                    onclick="if(confirm('Are you sure you want to reset all exchange rates to default values? This action cannot be undone.')) { window.location.href = '{{ request()->fullUrl() }}&reset=1'; }"
                >
                    Reset to Default Rates
                </x-filament::button>
            </div>
        </form>
    </x-filament::section>
    
    <x-filament::section class="mt-6">
        <x-slot name="heading">
            High Precision Exchange Rates
        </x-slot>
        
        <x-slot name="description">
            <div class="text-sm text-gray-600">
                <p class="mb-2"><strong>Precision Support:</strong></p>
                <ul class="list-disc list-inside space-y-1">
                    <li>Exchange rates support up to <strong>16 decimal places</strong> for maximum accuracy</li>
                    <li>Example: 83.1234567890123456 (perfect for cryptocurrency and precise financial calculations)</li>
                    <li>Internal calculations maintain full precision to prevent rounding errors</li>
                    <li>Display formatting automatically removes trailing zeros for clean presentation</li>
                </ul>
            </div>
        </x-slot>
    </x-filament::section>
    
    <x-filament::section class="mt-6">
        <x-slot name="heading">
            Live Exchange Rate Integration
        </x-slot>
        
        <x-slot name="description">
            <div class="text-sm text-gray-600">
                <p class="mb-2">For real-time exchange rates, you can integrate with services like:</p>
                <ul class="list-disc list-inside space-y-1">
                    <li><strong>Fixer.io</strong> - Professional exchange rate API</li>
                    <li><strong>CurrencyAPI</strong> - Free tier available with 1000 requests/month</li>
                    <li><strong>ExchangeRate-API</strong> - Free service with 2000 requests/month</li>
                </ul>
                <p class="mt-3 text-xs text-gray-500">
                    Note: Current rates are manually set. Contact your developer to enable automatic rate updates.
                </p>
            </div>
        </x-slot>
    </x-filament::section>
</x-filament-panels::page>
