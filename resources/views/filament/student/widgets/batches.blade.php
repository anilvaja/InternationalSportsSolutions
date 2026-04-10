<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">
            My Batches
        </x-slot>

        <div class="space-y-3">
            @forelse($activeBatches as $batch)
                <div class="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-900">{{ $batch->name }}</h4>
                            <p class="text-sm text-gray-600">{{ $batch->description ?? 'No description' }}</p>
                            
                            <div class="mt-2 space-y-1 text-xs text-gray-500">
                                @if($batch->branch)
                                    <p><span class="font-medium">Branch:</span> {{ $batch->branch->name }}</p>
                                @endif
                                @if($batch->coach)
                                    <p><span class="font-medium">Coach:</span> {{ $batch->coach->name }}</p>
                                @endif
                                @if($batch->schedule)
                                    <p><span class="font-medium">Schedule:</span> {{ $batch->schedule }}</p>
                                @endif
                            </div>
                        </div>
                        
                        <div class="flex-shrink-0 ml-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                       {{ $batch->status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' }}">
                                {{ ucfirst($batch->status ?? 'active') }}
                            </span>
                        </div>
                    </div>
                </div>
            @empty
                <div class="text-center py-6">
                    <div class="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        </svg>
                    </div>
                    <p class="mt-2 text-sm text-gray-500">No active batches found</p>
                    <p class="text-xs text-gray-400">Contact your academy to enroll in a batch</p>
                </div>
            @endforelse
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
