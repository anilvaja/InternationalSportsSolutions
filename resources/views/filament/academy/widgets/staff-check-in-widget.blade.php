<x-filament-widgets::widget>
    @if($hasUser)
    <x-filament::section>
        <div class="space-y-4">
            {{-- Header Row --}}
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div class="flex items-center space-x-3">
                    <div class="p-3 bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 rounded-xl">
                        <x-heroicon-o-clock class="w-7 h-7" />
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Daily Work & Attendance Tracker</span>
                            <span class="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                {{ $salaryTypeLabel }}
                            </span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            Log your check-in and check-out times. Worked time is calculated live in hours and minutes.
                        </p>
                    </div>
                </div>

                {{-- Action Buttons --}}
                <div class="flex items-center gap-2">
                    @if(!$isCheckedIn && !$isCheckedOut)
                        {{ ($this->checkInAction)(['class' => 'px-4 py-2 font-semibold']) }}
                    @elseif($isCheckedIn)
                        <span class="inline-flex items-center px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
                            ● Active Session (In at {{ $checkInTime }})
                        </span>
                        {{ ($this->checkOutAction)(['class' => 'px-4 py-2 font-semibold']) }}
                    @else
                        <span class="inline-flex items-center px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-full dark:bg-gray-800 dark:text-gray-300">
                            ✓ Session Completed (Out at {{ $checkOutTime }})
                        </span>
                    @endif

                    {{ ($this->logCustomTimeAction)(['class' => 'px-3 py-2 text-xs font-medium']) }}
                </div>
            </div>

            {{-- Metric Cards Grid --}}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {{-- Today's Status --}}
                <div class="p-4 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80">
                    <div class="text-xs text-slate-700 dark:text-slate-300 font-semibold">Today's Check In / Out</div>
                    <div class="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {{ $checkInTime }} <span class="text-slate-500 dark:text-slate-400 font-normal">to</span> {{ $checkOutTime }}
                    </div>
                    <div class="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        @if($isCheckedIn)
                            Working currently
                        @elseif($isCheckedOut)
                            Checked out today
                        @else
                            Not checked in yet
                        @endif
                    </div>
                </div>

                {{-- Today's Worked Duration (Hours + Minutes) --}}
                <div class="p-4 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-800/60">
                    <div class="text-xs text-blue-700 dark:text-blue-300 font-semibold flex items-center justify-between">
                        <span>Today Worked Time</span>
                        <x-heroicon-o-clock class="w-4 h-4 text-blue-500" />
                    </div>
                    <div class="text-lg font-bold text-blue-900 dark:text-blue-100 mt-1">
                        {{ $workedFormatted }}
                    </div>
                    <div class="text-xs text-blue-700/80 dark:text-blue-300/80 mt-1">
                        Calculated from check in/out
                    </div>
                </div>

                {{-- Today's Daily Pay --}}
                <div class="p-4 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                    <div class="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-between">
                        <span>Today Estimated Pay</span>
                        <x-heroicon-o-currency-dollar class="w-4 h-4 text-emerald-500" />
                    </div>
                    <div class="text-lg font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                        ₹{{ $todayPay }}
                    </div>
                    <div class="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                        Based on {{ $salaryTypeLabel }}
                    </div>
                </div>

                {{-- Monthly Worked & Earnings --}}
                <div class="p-4 bg-purple-50 dark:bg-purple-950/60 rounded-xl border border-purple-200 dark:border-purple-800/60">
                    <div class="text-xs text-purple-700 dark:text-purple-300 font-semibold flex items-center justify-between">
                        <span>Monthly Total</span>
                        <x-heroicon-o-chart-bar class="w-4 h-4 text-purple-500" />
                    </div>
                    <div class="text-base font-bold text-purple-900 dark:text-purple-100 mt-1">
                        ₹{{ $monthlyPay }}
                    </div>
                    <div class="text-xs text-purple-700/80 dark:text-purple-300/80 mt-1">
                        {{ $monthlyWorkedFormatted }} ({{ $daysWorkedThisMonth }} days)
                    </div>
                </div>
            </div>
        </div>

        <x-filament-actions::modals />
    </x-filament::section>
    @endif
</x-filament-widgets::widget>
