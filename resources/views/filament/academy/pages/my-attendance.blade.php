<x-filament-panels::page>
    <div class="space-y-6">
        {{-- Widget on top of page --}}
        @livewire(\App\Filament\Academy\Widgets\StaffCheckInWidget::class)

        {{-- Table section --}}
        <div class="space-y-2">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <x-heroicon-o-document-text class="w-5 h-5 text-primary-500" />
                <span>My Attendance & Daily Calculations History</span>
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
                Detailed record of all your check-in and check-out times, worked hours + minutes, and calculated daily pay.
            </p>
        </div>

        {{ $this->table }}
    </div>
</x-filament-panels::page>
