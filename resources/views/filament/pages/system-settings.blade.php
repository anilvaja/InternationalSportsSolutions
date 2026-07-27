<x-filament-panels::page>
    <x-filament-panels::form wire:submit="save">
        {{ $this->form }}

        <div class="mt-6 flex items-center justify-end gap-x-4">
            <x-filament::button type="submit">
                Save System Settings
            </x-filament::button>
        </div>
    </x-filament-panels::form>
</x-filament-panels::page>
