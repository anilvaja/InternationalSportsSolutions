<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">
            Fee Status
        </x-slot>

        <div class="space-y-4">
            <!-- Summary Cards -->
            <div class="grid grid-cols-2 gap-4">
                <div class="p-3 bg-blue-50 rounded-lg">
                    <p class="text-2xl font-bold text-blue-600">₹{{ number_format($totalOutstanding, 2) }}</p>
                    <p class="text-sm text-blue-800">Total Outstanding</p>
                </div>
                @if($overdueFees > 0)
                    <div class="p-3 bg-red-50 rounded-lg">
                        <p class="text-2xl font-bold text-red-600">{{ $overdueFees }}</p>
                        <p class="text-sm text-red-800">Overdue Fees</p>
                    </div>
                @else
                    <div class="p-3 bg-green-50 rounded-lg">
                        <p class="text-2xl font-bold text-green-600">✓</p>
                        <p class="text-sm text-green-800">All Up to Date</p>
                    </div>
                @endif
            </div>

            <!-- Pending Fees List -->
            @if($pendingFees->count() > 0)
                <div class="pt-4 border-t border-gray-200">
                    <h4 class="text-sm font-medium text-gray-900 mb-3">Upcoming Fees</h4>
                    <div class="space-y-2">
                        @foreach($pendingFees as $fee)
                            @php
                                $isOverdue = $fee->fees_from_date->isPast();
                                $daysUntilDue = $fee->fees_from_date->diffInDays(now(), false);
                            @endphp
                            <div class="flex items-center justify-between p-3 
                                      {{ $isOverdue ? 'bg-red-50 border border-red-200' : 'bg-gray-50' }} rounded-md">
                                <div class="flex-1">
                                    <p class="text-sm font-medium">₹{{ number_format($fee->fees_amount, 2) }}</p>
                                    <p class="text-xs text-gray-500">
                                        Due: {{ $fee->fees_from_date->format('M d, Y') }}
                                        @if($isOverdue)
                                            <span class="text-red-600 font-medium">({{ abs($daysUntilDue) }} days overdue)</span>
                                        @else
                                            <span class="text-blue-600">({{ $daysUntilDue }} days left)</span>
                                        @endif
                                    </p>
                                </div>
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
                                           {{ $isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800' }}">
                                    {{ $isOverdue ? 'Overdue' : 'Pending' }}
                                </span>
                            </div>
                        @endforeach
                    </div>
                    
                    @if($student->fees()->where('status', 'pending')->count() > 3)
                        <p class="mt-2 text-xs text-gray-500 text-center">
                            And {{ $student->fees()->where('status', 'pending')->count() - 3 }} more...
                        </p>
                    @endif
                </div>
            @else
                <div class="text-center py-4">
                    <div class="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                    <p class="mt-2 text-sm text-gray-500">No pending fees</p>
                    <p class="text-xs text-gray-400">All payments are up to date</p>
                </div>
            @endif
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
