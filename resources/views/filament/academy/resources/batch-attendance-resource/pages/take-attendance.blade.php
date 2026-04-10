<x-filament-panels::page>
    <x-filament::section>
        <x-slot name="heading">
            Take Attendance
        </x-slot>

        <x-slot name="description">
            Mark attendance for students in this class.
        </x-slot>

        <form wire:submit="saveAttendance">
            {{ $this->form }}

            <x-filament::button
                type="submit"
                size="lg"
                class="mt-6"
                wire:loading.attr="disabled"
            >
                <x-filament::loading-indicator 
                    class="h-5 w-5" 
                    wire:loading 
                    wire:target="saveAttendance" 
                />
                Save Attendance
            </x-filament::button>
        </form>
    </x-filament::section>
</x-filament-panels::page>
