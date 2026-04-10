<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">
            Attendance Overview
        </x-slot>
        
        <x-slot name="description">
            {{ $currentMonth }}
        </x-slot>

        <div class="space-y-4">
            <!-- Attendance Rate -->
            <div class="text-center">
                <div class="relative">
                    <div class="flex items-center justify-center w-24 h-24 mx-auto rounded-full border-8 
                                {{ $attendanceRate >= 85 ? 'border-green-200 text-green-600' : 
                                   ($attendanceRate >= 70 ? 'border-yellow-200 text-yellow-600' : 'border-red-200 text-red-600') }}">
                        <span class="text-2xl font-bold">{{ $attendanceRate }}%</span>
                    </div>
                </div>
                <p class="mt-2 text-sm text-gray-600">Overall Attendance</p>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                <div class="text-center">
                    <p class="text-lg font-semibold text-blue-600">{{ $totalClasses }}</p>
                    <p class="text-xs text-gray-500">Total Classes</p>
                </div>
                <div class="text-center">
                    <p class="text-lg font-semibold text-green-600">{{ $presentClasses }}</p>
                    <p class="text-xs text-gray-500">Present</p>
                </div>
                <div class="text-center">
                    <p class="text-lg font-semibold text-red-600">{{ $absentClasses }}</p>
                    <p class="text-xs text-gray-500">Absent</p>
                </div>
            </div>

            <!-- Attendance Status -->
            @if($attendanceRate >= 85)
                <div class="p-3 bg-green-50 rounded-md">
                    <p class="text-sm text-green-800">
                        <span class="font-medium">Excellent attendance!</span> Keep up the great work.
                    </p>
                </div>
            @elseif($attendanceRate >= 70)
                <div class="p-3 bg-yellow-50 rounded-md">
                    <p class="text-sm text-yellow-800">
                        <span class="font-medium">Good attendance.</span> Try to attend more regularly.
                    </p>
                </div>
            @else
                <div class="p-3 bg-red-50 rounded-md">
                    <p class="text-sm text-red-800">
                        <span class="font-medium">Low attendance.</span> Please focus on regular attendance.
                    </p>
                </div>
            @endif
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
