<x-filament-panels::page>
    <div class="space-y-6">
        <!-- Header Section -->
        <div>
            <h2 class="text-xl font-semibold text-gray-900">My Syllabus</h2>
            <p class="text-sm text-gray-600">Track your learning progress and mastered techniques</p>
        </div>

        <!-- Progress Overview -->
        <div class="bg-white rounded-lg border border-gray-200 p-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Current Belt -->
                <div class="text-center">
                    <div class="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900">{{ $syllabusData['current_belt'] }}</h3>
                    <p class="text-sm text-gray-600">Current Level</p>
                </div>

                <!-- Progress Circle -->
                <div class="text-center">
                    <div class="relative w-24 h-24 mx-auto mb-3">
                        <svg class="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" stroke="#e5e7eb" stroke-width="8" fill="none"/>
                            <circle cx="50" cy="50" r="45" stroke="#3b82f6" stroke-width="8" fill="none"
                                    stroke-dasharray="{{ 2 * pi() * 45 }}"
                                    stroke-dashoffset="{{ 2 * pi() * 45 * (1 - $syllabusData['progress_percentage'] / 100) }}"
                                    stroke-linecap="round"/>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-xl font-bold text-gray-900">{{ $syllabusData['progress_percentage'] }}%</span>
                        </div>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900">Progress</h3>
                    <p class="text-sm text-gray-600">{{ $syllabusData['completed_techniques'] }}/{{ $syllabusData['total_techniques'] }} Techniques</p>
                </div>

                <!-- Next Belt -->
                <div class="text-center">
                    <div class="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-3">
                        <svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900">{{ $syllabusData['next_belt'] }}</h3>
                    <p class="text-sm text-gray-600">Next Goal</p>
                </div>
            </div>
        </div>

        <!-- Technique Categories -->
        <div class="space-y-6">
            @foreach($syllabusData['categories'] as $category)
                <div class="bg-white rounded-lg border border-gray-200">
                    <div class="px-6 py-4 border-b border-gray-200">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-medium text-gray-900">{{ $category['name'] }}</h3>
                                <p class="text-sm text-gray-600">{{ $category['description'] }}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm font-medium text-gray-900">
                                    {{ $category['completed'] }}/{{ $category['total'] }} Complete
                                </p>
                                <div class="w-24 bg-gray-200 rounded-full h-2 mt-1">
                                    @php
                                        $progressWidth = $category['total'] > 0 ? ($category['completed'] / $category['total']) * 100 : 0;
                                    @endphp
                                    <div class="bg-blue-600 h-2 rounded-full" 
                                         style="width: {{ $progressWidth }}%">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            @foreach($category['techniques'] as $technique)
                                <div class="flex items-center justify-between p-3 rounded-lg border 
                                          {{ $technique['status'] === 'completed' ? 'border-green-200 bg-green-50' : 
                                             ($technique['status'] === 'in_progress' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-gray-50') }}">
                                    <div class="flex items-center space-x-3">
                                        <div class="flex-shrink-0">
                                            @if($technique['status'] === 'completed')
                                                <div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                                    </svg>
                                                </div>
                                            @elseif($technique['status'] === 'in_progress')
                                                <div class="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                    </svg>
                                                </div>
                                            @else
                                                <div class="w-6 h-6 bg-gray-300 rounded-full"></div>
                                            @endif
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <p class="text-sm font-medium text-gray-900">{{ $technique['name'] }}</p>
                                            @if($technique['learned_date'])
                                                <p class="text-xs text-gray-500">
                                                    Learned: {{ \Carbon\Carbon::parse($technique['learned_date'])->format('M d, Y') }}
                                                </p>
                                            @endif
                                        </div>
                                    </div>
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                               {{ $technique['status'] === 'completed' ? 'bg-green-100 text-green-800' : 
                                                  ($technique['status'] === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800') }}">
                                        {{ $technique['status'] === 'completed' ? 'Mastered' : 
                                           ($technique['status'] === 'in_progress' ? 'Learning' : 'Upcoming') }}
                                    </span>
                                </div>
                            @endforeach
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    </div>
</x-filament-panels::page>
