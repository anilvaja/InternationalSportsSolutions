<x-filament-panels::page>
    <div class="space-y-8">
        <!-- Header Section -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">My Attendance</h2>
                    <p class="text-gray-600 mt-1">Track your class attendance and progress</p>
                </div>
                
                <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <!-- Period Type Selector -->
                    <div class="flex items-center space-x-3 bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                        <label class="text-sm font-medium text-gray-700">View:</label>
                        <select 
                            wire:model.live="viewType" 
                            class="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm min-w-0"
                        >
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Full Year</option>
                            <option value="all-time">Since Beginning</option>
                        </select>
                    </div>

                    <!-- Month/Year Selector (conditional) -->
                    <div class="flex items-center space-x-3 bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                        @if($viewType === 'monthly')
                            <label class="text-sm font-medium text-gray-700">Month:</label>
                            <input 
                                type="month" 
                                wire:model.live="selectedMonth"
                                class="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                        @elseif($viewType === 'yearly')
                            <label class="text-sm font-medium text-gray-700">Year:</label>
                            <select 
                                wire:model.live="selectedYear" 
                                class="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                                @for($year = date('Y'); $year >= 2020; $year--)
                                    <option value="{{ $year }}">{{ $year }}</option>
                                @endfor
                            </select>
                        @else
                            <div class="flex items-center space-x-2">
                                <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>
                                <span class="text-sm font-medium text-gray-700">All Time Records</span>
                            </div>
                        @endif
                    </div>

                    <!-- Quick Stats Badge -->
                    <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg px-4 py-2 shadow-sm">
                        <div class="text-center">
                            <p class="text-xs font-medium opacity-90">
                                @if($viewType === 'monthly')
                                    This Month
                                @elseif($viewType === 'yearly')
                                    Year {{ $selectedYear ?? date('Y') }}
                                @else
                                    Complete Journey
                                @endif
                            </p>
                            <p class="text-lg font-bold">{{ $attendanceData['total_classes'] }} Classes</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
            <!-- Total Classes Card -->
            <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-3xl font-bold text-blue-800">{{ $attendanceData['total_classes'] }}</p>
                        <p class="text-sm text-blue-700 font-medium">Total Classes</p>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-t border-blue-200">
                    <p class="text-xs text-blue-600">
                        @if($viewType === 'monthly')
                            This month's schedule
                        @elseif($viewType === 'yearly')
                            Year {{ $selectedYear ?? date('Y') }} total
                        @else
                            Complete academic journey
                        @endif
                    </p>
                </div>
            </div>

            <!-- Present Card -->
            <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-3xl font-bold text-green-800">{{ $attendanceData['present'] }}</p>
                        <p class="text-sm text-green-700 font-medium">Present</p>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-t border-green-200">
                    <p class="text-xs text-green-600">
                        @if($attendanceData['total_classes'] > 0)
                            {{ round(($attendanceData['present'] / $attendanceData['total_classes']) * 100, 1) }}% of total
                        @else
                            Great attendance!
                        @endif
                    </p>
                </div>
            </div>

            <!-- Late Card -->
            <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-sm border border-yellow-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-3xl font-bold text-yellow-800">{{ $attendanceData['late'] ?? 0 }}</p>
                        <p class="text-sm text-yellow-700 font-medium">Late</p>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-t border-yellow-200">
                    <p class="text-xs text-yellow-600">
                        @if($attendanceData['total_classes'] > 0)
                            {{ round((($attendanceData['late'] ?? 0) / $attendanceData['total_classes']) * 100, 1) }}% of total
                        @else
                            Try to be on time!
                        @endif
                    </p>
                </div>
            </div>

            <!-- Absent Card -->
            <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm border border-red-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-3xl font-bold text-red-800">{{ $attendanceData['absent'] }}</p>
                        <p class="text-sm text-red-700 font-medium">Absent</p>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-t border-red-200">
                    <p class="text-xs text-red-600">
                        @if($attendanceData['total_classes'] > 0)
                            {{ round(($attendanceData['absent'] / $attendanceData['total_classes']) * 100, 1) }}% of total
                        @else
                            Keep up the attendance!
                        @endif
                    </p>
                </div>
            </div>

            <!-- Attendance Rate Card -->
            <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm border border-purple-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group sm:col-span-2 md:col-span-1">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-4">
                        <p class="text-3xl font-bold text-purple-800">{{ $attendanceData['attendance_rate'] }}%</p>
                        <p class="text-sm text-purple-700 font-medium">Attendance Rate</p>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-t border-purple-200">
                    <div class="flex items-center space-x-2">
                        @if($attendanceData['attendance_rate'] >= 90)
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                </svg>
                                Excellent
                            </span>
                        @elseif($attendanceData['attendance_rate'] >= 75)
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                </svg>
                                Good
                            </span>
                        @else
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                                </svg>
                                Needs Improvement
                            </span>
                        @endif
                    </div>
                </div>
            </div>
        </div>

        <!-- Attendance Calendar/List -->
        <div class="bg-white rounded-lg border border-gray-200">
            <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-medium text-gray-900">
                            @if($viewType === 'monthly')
                                Daily Attendance - {{ \Carbon\Carbon::parse($selectedMonth ?? now())->format('F Y') }}
                            @elseif($viewType === 'yearly')
                                Yearly Attendance - {{ $selectedYear ?? date('Y') }}
                            @else
                                Complete Attendance History
                            @endif
                        </h3>
                        <p class="text-sm text-gray-500 mt-1">
                            @if(empty($attendanceData['daily_attendance']))
                                No attendance records found for the selected period.
                            @else
                                Showing {{ count($attendanceData['daily_attendance']) }} attendance records
                                @if($viewType === 'all-time')
                                    from your entire academic journey
                                @elseif($viewType === 'yearly')
                                    for the year {{ $selectedYear ?? date('Y') }}
                                @else
                                    for {{ \Carbon\Carbon::parse($selectedMonth ?? now())->format('F Y') }}
                                @endif
                            @endif
                        </p>
                    </div>
                    
                    <!-- Period Summary Badge -->
                    @if(!empty($attendanceData['daily_attendance']))
                        <div class="flex items-center space-x-3">
                            <!-- Filter/Sort Options for Large Datasets -->
                            @if($viewType !== 'monthly' && count($attendanceData['daily_attendance']) > 10)
                                <div class="flex items-center space-x-2">
                                    <button 
                                        type="button"
                                        onclick="document.getElementById('attendance-grid').scrollIntoView({behavior: 'smooth'})"
                                        class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                                    >
                                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                        </svg>
                                        View {{ count($attendanceData['daily_attendance']) }} Records
                                    </button>
                                </div>
                            @endif
                            
                            <div class="text-right">
                                <div class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                                          {{ $attendanceData['attendance_rate'] >= 90 ? 'bg-green-100 text-green-800' : 
                                             ($attendanceData['attendance_rate'] >= 75 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800') }}">
                                    {{ $attendanceData['attendance_rate'] }}% Overall
                                </div>
                                <p class="text-xs text-gray-500 mt-1">
                                    @if($viewType === 'all-time')
                                        Since enrollment
                                    @elseif($viewType === 'yearly')
                                        This year
                                    @else
                                        This month
                                    @endif
                                </p>
                            </div>
                        </div>
                    @endif
                </div>
            </div>
            <div class="p-6" id="attendance-grid">
                @if(empty($attendanceData['daily_attendance']))
                    <div class="text-center py-12">
                        <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <h3 class="mt-4 text-lg font-medium text-gray-900">No attendance records found</h3>
                        <p class="mt-2 text-sm text-gray-500">
                            @if($viewType === 'all-time')
                                You haven't attended any classes yet. Your attendance journey will appear here once you start attending classes.
                            @elseif($viewType === 'yearly')
                                No classes were recorded for {{ $selectedYear ?? date('Y') }}. Try selecting a different year.
                            @else
                                No classes were recorded for {{ \Carbon\Carbon::parse($selectedMonth ?? now())->format('F Y') }}. Try selecting a different month.
                            @endif
                        </p>
                        
                        @if($viewType !== 'all-time')
                            <div class="mt-6">
                                <button 
                                    type="button"
                                    wire:click="$set('viewType', 'all-time')"
                                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                    </svg>
                                    View All Time Records
                                </button>
                            </div>
                        @endif
                    </div>
                @else
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        @foreach($attendanceData['daily_attendance'] as $attendance)
                            <div class="relative rounded-lg border-2 transition-all duration-200 hover:shadow-md
                                      {{ $attendance['status'] === 'present' ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-100' : 
                                         ($attendance['status'] === 'late' ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100' : 
                                         ($attendance['status'] === 'excused' ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100' : 'border-red-300 bg-gradient-to-br from-red-50 to-red-100')) }}">
                                
                                <!-- Status Badge -->
                                <div class="absolute -top-2 -right-2">
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold shadow-sm
                                               {{ $attendance['status'] === 'present' ? 'bg-green-500 text-white' : 
                                                  ($attendance['status'] === 'late' ? 'bg-yellow-500 text-white' : 
                                                  ($attendance['status'] === 'excused' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white')) }}">
                                        {{ ucfirst($attendance['status']) }}
                                    </span>
                                </div>

                                <div class="p-4">
                                    <!-- Date -->
                                    <div class="text-center mb-3">
                                        <p class="text-lg font-bold text-gray-900">
                                            {{ \Carbon\Carbon::parse($attendance['date'])->format('d') }}
                                        </p>
                                        <p class="text-sm font-medium text-gray-600">
                                            {{ \Carbon\Carbon::parse($attendance['date'])->format('M Y') }}
                                        </p>
                                        <p class="text-xs text-gray-500">
                                            {{ \Carbon\Carbon::parse($attendance['date'])->format('l') }}
                                        </p>
                                    </div>

                                    <!-- Batch Info -->
                                    <div class="text-center mb-3">
                                        <p class="text-sm font-medium text-gray-800 truncate" title="{{ $attendance['batch_name'] }}">
                                            {{ $attendance['batch_name'] }}
                                        </p>
                                        @if($attendance['start_time'] && $attendance['end_time'])
                                            <p class="text-xs text-gray-600 mt-1">
                                                <span class="inline-flex items-center">
                                                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                    </svg>
                                                    {{ $attendance['start_time'] }} - {{ $attendance['end_time'] }}
                                                </span>
                                            </p>
                                        @endif
                                    </div>

                                    <!-- Arrival Time (for present/late) -->
                                    @if($attendance['actual_arrival_time'] && in_array($attendance['status'], ['present', 'late']))
                                        <div class="text-center mb-2">
                                            <p class="text-xs text-gray-600">
                                                <span class="inline-flex items-center">
                                                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                                                    </svg>
                                                    Arrived: {{ $attendance['actual_arrival_time'] }}
                                                </span>
                                            </p>
                                        </div>
                                    @endif

                                    <!-- Participation Level -->
                                    @if(!empty($attendance['participation_level']))
                                        <div class="text-center mb-2">
                                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                                       {{ $attendance['participation_level'] === 'excellent' ? 'bg-green-100 text-green-800' : 
                                                          ($attendance['participation_level'] === 'good' ? 'bg-blue-100 text-blue-800' : 
                                                          ($attendance['participation_level'] === 'average' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800')) }}">
                                                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                                </svg>
                                                {{ ucfirst($attendance['participation_level']) }}
                                            </span>
                                        </div>
                                    @endif

                                    <!-- Notes (if any) -->
                                    @if(!empty($attendance['notes']))
                                        <div class="mt-2 pt-2 border-t border-gray-200">
                                            <p class="text-xs text-gray-600 text-center">
                                                <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                                </svg>
                                                <span class="italic">{{ Str::limit($attendance['notes'], 30) }}</span>
                                            </p>
                                        </div>
                                    @endif
                                </div>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
        </div>
    </div>
</x-filament-panels::page>
