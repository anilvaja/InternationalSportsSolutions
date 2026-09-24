<x-filament-widgets::widget>
    @php
        $attData = $this->getTodayAttendanceData();
        $todayBatches = $this->getTodayBatches();
    @endphp

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {{-- 1. Today's Student Attendance Summary --}}
        <div class="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between space-y-4">
            <div>
                <div class="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div class="flex items-center space-x-2">
                        <div class="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <x-heroicon-o-clipboard-document-check class="w-4 h-4" />
                        </div>
                        <h3 class="text-sm font-bold text-gray-900 dark:text-white">
                            Today's Class Attendance
                        </h3>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <a href="{{ url('/academy/attendances/create') }}" class="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors">
                            + Mark Attendance
                        </a>
                        <a href="{{ url('/academy/attendances') }}" class="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 transition-colors">
                            View All
                        </a>
                    </div>
                </div>

                {{-- Attendance Numbers Grid --}}
                <div class="grid grid-cols-4 gap-2 text-center mt-3">
                    <div class="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                        <div class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Present</div>
                        <div class="text-lg font-black text-emerald-900 dark:text-emerald-200 mt-0.5">{{ $attData['presentCount'] }}</div>
                    </div>
                    <div class="p-2.5 bg-rose-50/70 dark:bg-rose-950/40 rounded-lg border border-rose-100 dark:border-rose-900/50">
                        <div class="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Absent</div>
                        <div class="text-lg font-black text-rose-900 dark:text-rose-200 mt-0.5">{{ $attData['absentCount'] }}</div>
                    </div>
                    <div class="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-lg border border-amber-100 dark:border-amber-900/50">
                        <div class="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Late</div>
                        <div class="text-lg font-black text-amber-900 dark:text-amber-200 mt-0.5">{{ $attData['lateCount'] }}</div>
                    </div>
                    <div class="p-2.5 bg-primary-50/70 dark:bg-primary-950/40 rounded-lg border border-primary-100 dark:border-primary-900/50">
                        <div class="text-[11px] font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wider">Attendance</div>
                        <div class="text-lg font-black text-primary-900 dark:text-primary-200 mt-0.5">{{ $attData['percentage'] }}%</div>
                    </div>
                </div>

                {{-- Progress Bar --}}
                <div class="mt-3">
                    <div class="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        <span>Attendance Ratio</span>
                        <span>{{ $attData['percentage'] }}% Rate</span>
                    </div>
                    <div class="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div class="bg-emerald-500 h-2 rounded-full transition-all duration-500" style="width: {{ $attData['percentage'] }}%"></div>
                    </div>
                </div>
            </div>

            {{-- Recent Absences Section --}}
            <div class="pt-2 border-t border-gray-100 dark:border-gray-800">
                <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Recent Absences
                </div>

                @if(count($attData['recentAbsences']) > 0)
                    <div class="space-y-1.5">
                        @foreach($attData['recentAbsences'] as $abs)
                            <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 text-xs">
                                <div class="flex items-center space-x-2">
                                    <x-heroicon-o-user-minus class="w-4 h-4 text-rose-500" />
                                    <span class="font-bold text-gray-900 dark:text-white">{{ $abs->student?->name ?? 'Student #' . $abs->student_id }}</span>
                                    <span class="text-gray-400 font-normal">({{ $abs->batchAttendance?->batch?->name ?? 'Batch' }})</span>
                                </div>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                                    Absent
                                </span>
                            </div>
                        @endforeach
                    </div>
                @else
                    <div class="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/40 text-center text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1.5">
                        <x-heroicon-o-check-circle class="w-4 h-4 text-emerald-500" />
                        <span>No student absences recorded in recent sessions.</span>
                    </div>
                @endif
            </div>
        </div>

        {{-- 2. Today's Batch Schedule Timeline --}}
        <div class="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between space-y-3">
            <div>
                <div class="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div class="flex items-center space-x-2">
                        <div class="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
                            <x-heroicon-o-clock class="w-4 h-4" />
                        </div>
                        <h3 class="text-sm font-bold text-gray-900 dark:text-white">
                            Today's Batch Schedule
                        </h3>
                    </div>

                    <a href="{{ url('/academy/batches') }}" class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                        View Batches →
                    </a>
                </div>

                @if(count($todayBatches) > 0)
                    <div class="mt-3 space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        @foreach($todayBatches as $b)
                            <div class="p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center justify-between text-xs group">
                                <div class="flex items-center space-x-3">
                                    <div class="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold text-[11px] shrink-0">
                                        {{ $b->start_time ? \Carbon\Carbon::parse($b->start_time)->format('h:i A') : 'TBD' }}
                                    </div>

                                    <div>
                                        <div class="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                            <span>{{ $b->name }}</span>
                                            @if($b->code)
                                                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                    {{ $b->code }}
                                                </span>
                                            @endif
                                        </div>
                                        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                            <span>Coach: {{ $b->coach?->name ?? 'Unassigned' }}</span>
                                            @if($b->branch)
                                                <span>• Location: {{ $b->branch->name }}</span>
                                            @endif
                                        </div>
                                    </div>
                                </div>

                                <a href="{{ url('/academy/attendances/create?batch_id=' . $b->id) }}" class="px-2.5 py-1 text-xs font-semibold rounded bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors shrink-0">
                                    Mark
                                </a>
                            </div>
                        @endforeach
                    </div>
                @else
                    <div class="mt-4 p-6 text-center rounded-lg bg-gray-50 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 space-y-2">
                        <x-heroicon-o-calendar class="w-7 h-7 mx-auto text-gray-400" />
                        <div class="text-xs font-bold text-gray-800 dark:text-gray-200">No Batches Scheduled Today</div>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400">
                            Enjoy the quiet day! Or create a new batch schedule if needed.
                        </p>
                        <a href="{{ url('/academy/batches/create') }}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors mt-1">
                            + Create Batch Schedule
                        </a>
                    </div>
                @endif
            </div>
        </div>
    </div>
</x-filament-widgets::widget>
