<x-filament-widgets::widget>
    <div class="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        @php
            $user = Auth::user();
            $hour = now()->hour;
            $greeting = $hour < 12 ? 'Good Morning' : ($hour < 17 ? 'Good Afternoon' : 'Good Evening');
            $branches = $this->getBranches();
        @endphp

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {{-- Greeting & Branch Filter --}}
            <div>
                <div class="flex items-center gap-3">
                    <h1 class="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {{ $greeting }}, {{ $user->name ?? 'Admin' }} 👋
                    </h1>

                    @if(count($branches) > 0)
                        <div class="inline-flex items-center gap-1.5">
                            <x-heroicon-o-building-office class="w-4 h-4 text-gray-400" />
                            <select wire:model.live="selectedBranchId" class="text-xs font-semibold py-1 px-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 focus:ring-primary-500 focus:border-primary-500">
                                <option value="all">All Branches ({{ count($branches) }})</option>
                                @foreach($branches as $id => $name)
                                    <option value="{{ $id }}">{{ $name }}</option>
                                @endforeach
                            </select>
                        </div>
                    @endif
                </div>

                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
                    {{ now()->format('l, d F Y') }} • Operational Academy Overview
                </p>
            </div>

            {{-- Quick Action Pills Bar --}}
            <div class="flex flex-wrap items-center gap-2">
                @if(\App\Support\AcademyPermissionHelper::can('create_students'))
                    <a href="{{ url('/academy/students/create') }}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors shadow-xs">
                        <x-heroicon-m-plus class="w-3.5 h-3.5" />
                        <span>Student</span>
                    </a>
                @endif

                @if(\App\Support\AcademyPermissionHelper::can('create_fees'))
                    <a href="{{ url('/academy/fee-collections/create') }}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 transition-colors shadow-xs">
                        <x-heroicon-m-currency-rupee class="w-3.5 h-3.5" />
                        <span>Collect Fee</span>
                    </a>
                @endif

                @if(\App\Support\AcademyPermissionHelper::can('create_attendances'))
                    <a href="{{ url('/academy/attendances/create') }}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors shadow-xs">
                        <x-heroicon-m-clipboard-document-check class="w-3.5 h-3.5" />
                        <span>Mark Attendance</span>
                    </a>
                @endif

                @if(\App\Support\AcademyPermissionHelper::can('create_batches'))
                    <a href="{{ url('/academy/batches/create') }}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 transition-colors shadow-xs">
                        <x-heroicon-m-rectangle-stack class="w-3.5 h-3.5" />
                        <span>Batch</span>
                    </a>
                @endif

                @if(\App\Support\AcademyPermissionHelper::can('create_staff_leaves'))
                    <a href="{{ url('/academy/staff-leaves/create') }}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-500 dark:hover:bg-rose-600 transition-colors shadow-xs">
                        <x-heroicon-m-calendar-days class="w-3.5 h-3.5" />
                        <span>Apply Leave</span>
                    </a>
                @endif
            </div>
        </div>
    </div>
</x-filament-widgets::widget>
