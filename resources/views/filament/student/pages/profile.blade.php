<x-filament-panels::page>
    <div class="space-y-6">
        <!-- Profile Header -->
        <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
            <div class="flex items-center space-x-4">
                <div class="flex-shrink-0">
                    @php
                        $student = auth('student')->user();
                        $firstName = '';
                        $fullName = 'Student';
                        
                        if ($student) {
                            try {
                                $fullName = $student->getSafeFullName();
                                $firstName = $fullName;
                            } catch (Exception $e) {
                                $fullName = 'Student';
                                $firstName = 'Student';
                            }
                        }
                        
                        $initials = collect(explode(' ', $firstName))->map(fn($name) => substr($name, 0, 1))->take(2)->implode('');
                        if (empty($initials)) {
                            $initials = 'ST';
                        }
                    @endphp
                    
                    @if($student && $student->photo)
                        <img class="h-16 w-16 rounded-full object-cover border-4 border-white/20" 
                             src="{{ Storage::url($student->photo) }}" 
                             alt="{{ $fullName }}">
                    @else
                        <div class="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/20">
                            <span class="text-xl font-bold text-white">{{ $initials }}</span>
                        </div>
                    @endif
                </div>
                
                <div class="flex-1">
                    <h1 class="text-2xl font-bold">{{ $fullName }}</h1>
                    <p class="text-blue-100">Student Profile Management</p>
                    <div class="flex items-center mt-2 space-x-4">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                            </svg>
                            {{ $student->student_id ?? 'N/A' }}
                        </span>
                        
                        @if($student && $student->belt_level)
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900">
                                🥋 {{ $student->belt_level }} Belt
                            </span>
                        @endif
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center">
                    <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">
                            {{ $student ? ucfirst($student->status ?? 'Active') : 'N/A' }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center">
                    <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Batches</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">
                            {{ $student ? $student->activeBatches()->count() : 0 }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center">
                    <div class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                        <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Age</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">
                            {{ $student && $student->date_of_birth ? $student->date_of_birth->age . ' years' : 'N/A' }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center">
                    <div class="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Member Since</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">
                            {{ $student && $student->enrollment_date ? $student->enrollment_date->format('M Y') : 'N/A' }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Form -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <form wire:submit="save">
                {{ $this->form }}
                
                <div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl border-t border-gray-200 dark:border-gray-600">
                    <div class="flex items-center justify-between">
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                            <p>Keep your profile information up to date for better academy communication.</p>
                        </div>
                        <div class="flex space-x-3">
                            @foreach($this->getFormActions() as $action)
                                {{ $action }}
                            @endforeach
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <!-- Help Section -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
                <div class="ml-3">
                    <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">Profile Help</h3>
                    <div class="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        <ul class="space-y-1">
                            <li>• Ensure your contact information is accurate for emergency situations</li>
                            <li>• Medical information helps instructors provide better care during training</li>
                            <li>• Profile photo helps instructors identify you in large classes</li>
                            <li>• Contact academy administration if you need to update restricted fields</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-filament-panels::page>
