<x-filament-panels::page>
    <x-filament::section>
        <x-slot name="heading">
            Currency Settings
        </x-slot>
        
        <x-slot name="description">
            Configure your academy's primary currency name and symbol/icon for fees, payroll, and receipts.
        </x-slot>

        <form wire:submit="save">
            {{ $this->form }}
            
            <div class="mt-6 flex gap-3">
                <x-filament::button type="submit">
                    Save Currency Settings
                </x-filament::button>
            </div>
        </form>
    </x-filament::section>
</x-filament-panels::page>
