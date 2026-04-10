<x-filament-panels::page>
    <div class="space-y-8">
        <!-- Hero Welcome Section -->
        <div class="relative overflow-hidden">
            <div class="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 text-white shadow-2xl">
                <!-- Background Pattern -->
                <div class="absolute inset-0 opacity-10">
                    <svg class="w-full h-full" fill="currentColor" viewBox="0 0 100 100">
                        <defs>
                            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                <circle cx="5" cy="5" r="1"/>
                            </pattern>
                        </defs>
                        <rect width="100" height="100" fill="url(#grid)"/>
                    </svg>
                </div>
                
                <div class="relative z-10">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-4">
                                <div class="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                    </svg>
                                </div>
                                <div>
                                    <h1 class="text-3xl font-bold mb-2">
                                        Welcome back, {{ auth('student')->user()->getSafeFullName() }}! 👋
                                    </h1>
                                    <p class="text-xl text-blue-100 font-medium">
                                        Ready to continue your martial arts journey?
                                    </p>
                                </div>
                            </div>
                            
                            <div class="flex flex-wrap gap-4 mt-6">
                                <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                                    <div class="flex items-center space-x-2">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <span class="font-medium">{{ now()->format('l, F d, Y') }}</span>
                                    </div>
                                </div>
                                
                                @if(auth('student')->user()->activeBatches()->exists())
                                <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                                    <div class="flex items-center space-x-2">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                                        </svg>
                                        <span class="font-medium">{{ auth('student')->user()->activeBatches()->count() }} Active Batch{{ auth('student')->user()->activeBatches()->count() > 1 ? 'es' : '' }}</span>
                                    </div>
                                </div>
                                @endif
                            </div>
                        </div>
                        
                        <!-- Quick Action Buttons -->
                        <div class="hidden lg:flex flex-col space-y-3">
                            <a href="{{ \App\Filament\Student\Pages\Attendance::getUrl() }}" 
                               class="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-lg px-6 py-3 text-center transition-all duration-200 hover:scale-105 hover:shadow-lg">
                                <div class="flex items-center space-x-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                                    </svg>
                                    <span class="font-semibold">View Attendance</span>
                                </div>
                            </a>
                            
                            <a href="{{ \App\Filament\Student\Pages\Fees::getUrl() }}" 
                               class="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-lg px-6 py-3 text-center transition-all duration-200 hover:scale-105 hover:shadow-lg">
                                <div class="flex items-center space-x-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                                    </svg>
                                    <span class="font-semibold">My Fees</span>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Row 1 - Student Profile (Full Width) -->
        <div class="mb-6">
            <div class="w-full">
                @livewire(\App\Filament\Student\Widgets\StudentProfileWidget::class)
            </div>
        </div>

        <!-- Row 2 - Quick Actions (Full Width) -->
        <div class="mb-6">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="p-6">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                        <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        Quick Actions
                    </h3>
                    <!-- Internal content arranged side by side -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <a href="{{ \App\Filament\Student\Pages\Profile::getUrl() }}" 
                           class="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 group quick-action-item">
                            <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors quick-action-icon">
                                <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                </svg>
                            </div>
                            <span class="font-medium text-gray-900 dark:text-white">Update Profile</span>
                        </a>
                        
                        <a href="{{ \App\Filament\Student\Pages\Attendance::getUrl() }}" 
                           class="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 group quick-action-item">
                            <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg mr-3 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors quick-action-icon">
                                <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                                </svg>
                            </div>
                            <span class="font-medium text-gray-900 dark:text-white">View Attendance</span>
                        </a>
                        
                        <a href="{{ \App\Filament\Student\Pages\Fees::getUrl() }}" 
                           class="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 group quick-action-item">
                            <div class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg mr-3 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-800 transition-colors quick-action-icon">
                                <svg class="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                                </svg>
                            </div>
                            <span class="font-medium text-gray-900 dark:text-white">Fee Payments</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Row 3 - Attendance Overview (Full Width) -->
        <div class="mb-6">
            <div class="w-full">
                @livewire(\App\Filament\Student\Widgets\AttendanceOverviewWidget::class)
            </div>
        </div>

        <!-- Row 4 - Batches Widget (Full Width) -->
        <div class="mb-6">
            <div class="w-full">
                @livewire(\App\Filament\Student\Widgets\BatchesWidget::class)
            </div>
        </div>

        <!-- Row 5 - Fees Widget (Full Width) -->
        <div class="mb-6">
            <div class="w-full">
                @livewire(\App\Filament\Student\Widgets\FeesWidget::class)
            </div>
        </div>

        <!-- Row 6 - Recent Notifications (Full Width) -->
        <div class="mb-6">
            <div class="w-full">
                @livewire(\App\Filament\Student\Widgets\RecentNotificationsWidget::class)
            </div>
        </div>
    </div>
</x-filament-panels::page>
