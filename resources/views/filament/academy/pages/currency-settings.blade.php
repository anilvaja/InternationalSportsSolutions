<x-filament-panels::page>
    <x-filament::section>
        <x-slot name="heading">
            Currency & Timezone Settings
        </x-slot>
        
        <x-slot name="description">
            Configure your academy's primary currency name, icon/symbol, and local country/city timezone.
        </x-slot>

        <form wire:submit="save">
            {{ $this->form }}
            
            <div class="mt-6 flex gap-3">
                <x-filament::button type="submit">
                    Save Currency & Timezone Settings
                </x-filament::button>
            </div>
        </form>
    </x-filament::section>
</x-filament-panels::page>
