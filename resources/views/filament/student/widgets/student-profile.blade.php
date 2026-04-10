<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">
            <div class="flex items-center space-x-2">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <span class="font-semibold text-gray-900 dark:text-white">My Profile</span>
            </div>
        </x-slot>

        <div class="space-y-6">
            <!-- Student Info -->
            <div class="flex items-start space-x-4">
                <div class="flex-shrink-0 relative">
                    @if($student->photo)
                        <img class="h-20 w-20 rounded-full object-cover border-4 border-blue-100 shadow-lg" 
                             src="{{ Storage::url($student->photo) }}" 
                             alt="{{ $student->getSafeFullName() }}">
                    @else
                        <div class="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center border-4 border-blue-100 shadow-lg">
                            <span class="text-2xl font-bold text-white">
                                @php
                                    $firstName = is_string($student->first_name) ? $student->first_name : '';
                                    $lastName = is_string($student->last_name) ? $student->last_name : '';
                                @endphp
                                {{ substr($firstName, 0, 1) }}{{ substr($lastName, 0, 1) }}
                            </span>
                        </div>
                    @endif
                    
                    <!-- Online Status Indicator -->
                    <div class="absolute -bottom-1 -right-1 h-6 w-6 bg-green-400 border-2 border-white rounded-full flex items-center justify-center">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                    </div>
                </div>
                
                <div class="flex-1 min-w-0">
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {{ $student->getSafeFullName() }}
                    </h3>
                    <div class="space-y-2">
                        <div class="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"/>
                            </svg>
                            ID: {{ $student->student_id }}
                        </div>
                        
                        <div class="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                            {{ $student->email }}
                        </div>
                        
                        @if($student->belt_level)
                            <div class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 shadow-md">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"/>
                                </svg>
                                {{ $student->belt_level }} Belt
                            </div>
                        @endif
                    </div>
                </div>
            </div>

            <!-- Quick Stats Grid -->
            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div class="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div class="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-lg mx-auto mb-2">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                    </div>
                    <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ $activeBatches->count() }}</p>
                    <p class="text-xs font-medium text-blue-700 dark:text-blue-300">Active Batches</p>
                </div>
                
                <div class="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg border border-green-200 dark:border-green-700">
                    <div class="flex items-center justify-center w-10 h-10 bg-green-500 rounded-lg mx-auto mb-2">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                    </div>
                    <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ $student->age }}</p>
                    <p class="text-xs font-medium text-green-700 dark:text-green-300">Years Old</p>
                </div>
            </div>

            <!-- Active Batches -->
            @if($activeBatches->count() > 0)
                <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <svg class="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                        Current Batches
                    </h4>
                    <div class="space-y-3">
                        @foreach($activeBatches as $batch)
                            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow duration-200">
                                <div class="flex items-center space-x-3">
                                    <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ $batch->name }}</span>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ $batch->branch->name ?? 'N/A' }}</p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        Active
                                    </span>
                                </div>
                            </div>
                        @endforeach
                    </div>
                </div>
            @endif
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
