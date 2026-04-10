<x-filament-panels::page>
    <div class="space-y-8">
        <!-- Header Section -->
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">My Fees</h2>
                    <p class="text-gray-600 mt-1">Manage your fee payments and view payment history</p>
                </div>
                
                <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <!-- View Type Selector -->
                    <div class="flex items-center space-x-3 bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                        <label class="text-sm font-medium text-gray-700">View:</label>
                        <select 
                            wire:model.live="viewType" 
                            class="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm min-w-0"
                        >
                            <option value="all">All Fees</option>
                            <option value="pending">Pending</option>
                            <option value="overdue">Overdue</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>

                    <!-- Year Selector -->
                    <div class="flex items-center space-x-3 bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                        <label class="text-sm font-medium text-gray-700">Year:</label>
                        <select 
                            wire:model.live="selectedYear" 
                            class="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                        >
                            <option value="">All Years</option>
                            @for($year = date('Y'); $year >= 2020; $year--)
                                <option value="{{ $year }}">{{ $year }}</option>
                            @endfor
                        </select>
                    </div>

                    <!-- Quick Stats Badge -->
                    <div class="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg px-4 py-2 shadow-sm">
                        <div class="text-center">
                            <p class="text-xs font-medium opacity-90">
                                {{ ucfirst($viewType) }} {{ $selectedYear }}
                            </p>
                            <p class="text-lg font-bold">{{ $feesData['total_fees_count'] ?? 0 }} Records</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Top Row - Main Financial Info -->
            <div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Total Outstanding Card -->
                <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm border border-red-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-14 h-14 bg-red-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                                </svg>
                            </div>
                        </div>
                        <div class="ml-4 flex-1">
                            <p class="text-3xl font-bold text-red-800">₹{{ number_format($feesData['total_outstanding']) }}</p>
                            <p class="text-sm text-red-700 font-medium">Total Outstanding</p>
                            <div class="mt-2 pt-2 border-t border-red-200">
                                <p class="text-xs text-red-600">
                                    @if($feesData['total_outstanding'] > 0)
                                        Immediate payment required
                                    @else
                                        All payments up to date!
                                    @endif
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Overdue Fees Card -->
                <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border border-orange-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="ml-4 flex-1">
                            <p class="text-3xl font-bold text-orange-800">{{ $feesData['overdue_count'] }}</p>
                            <p class="text-sm text-orange-700 font-medium">Overdue Fees</p>
                            <div class="mt-2 pt-2 border-t border-orange-200">
                                <p class="text-xs text-orange-600">
                                    @if($feesData['overdue_count'] > 0)
                                        Urgent attention needed
                                    @else
                                        All caught up!
                                    @endif
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bottom Row - Due Date & Amount Info -->
            <div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Next Due Date Card -->
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="ml-4 flex-1">
                            <p class="text-3xl font-bold text-blue-800">
                                @if($feesData['next_due_date'])
                                    {{ \Carbon\Carbon::parse($feesData['next_due_date'])->format('M d') }}
                                @else
                                    --
                                @endif
                            </p>
                            <p class="text-sm text-blue-700 font-medium">Next Due Date</p>
                            <div class="mt-2 pt-2 border-t border-blue-200">
                                <p class="text-xs text-blue-600">
                                    @if($feesData['next_due_date'])
                                        {{ \Carbon\Carbon::parse($feesData['next_due_date'])->diffForHumans() }}
                                    @else
                                        No upcoming dues
                                    @endif
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Next Amount Card -->
                <div class="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-sm border border-emerald-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-14 h-14 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
                                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="ml-4 flex-1">
                            <p class="text-3xl font-bold text-emerald-800">₹{{ number_format($feesData['next_due_amount']) }}</p>
                            <p class="text-sm text-emerald-700 font-medium">Next Payment Amount</p>
                            <div class="mt-2 pt-2 border-t border-emerald-200">
                                <p class="text-xs text-emerald-600">
                                    @if($feesData['next_due_amount'] > 0)
                                        Next payment due
                                    @else
                                        No pending amount
                                    @endif
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pending Fees -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-medium text-gray-900">Pending Fees</h3>
                        <p class="text-sm text-gray-500 mt-1">
                            @if(empty($feesData['fees_list']))
                                No pending fees found.
                            @else
                                {{ count($feesData['fees_list']) }} pending payment(s)
                            @endif
                        </p>
                    </div>
                    @if(!empty($feesData['fees_list']))
                        <div class="flex items-center space-x-3">
                            <!-- Quick Actions for Large Datasets -->
                            @if(count($feesData['fees_list']) > 8)
                                <div class="flex items-center space-x-2">
                                    <button 
                                        type="button"
                                        onclick="document.getElementById('pending-fees-grid').scrollIntoView({behavior: 'smooth'})"
                                        class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                                    >
                                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                        </svg>
                                        View {{ count($feesData['fees_list']) }} Fees
                                    </button>
                                </div>
                            @endif
                            
                            <div class="text-right">
                                <div class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                                          {{ $feesData['overdue_count'] > 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800' }}">
                                    {{ $feesData['overdue_count'] > 0 ? 'Action Required' : 'Due Soon' }}
                                </div>
                                <p class="text-xs text-gray-500 mt-1">
                                    ₹{{ number_format($feesData['total_outstanding']) }} total
                                </p>
                            </div>
                        </div>
                    @endif
                </div>
            </div>
            <div class="p-6" id="pending-fees-grid">
                @if(empty($feesData['fees_list']))
                    <div class="text-center py-12">
                        <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <h3 class="mt-4 text-lg font-medium text-gray-900">All fees are up to date!</h3>
                        <p class="mt-2 text-sm text-gray-500">You have no pending fee payments at this time.</p>
                        
                        @if($viewType !== 'all')
                            <div class="mt-6">
                                <button 
                                    type="button"
                                    wire:click="$set('viewType', 'all')"
                                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                                >
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                    </svg>
                                    View All Fees
                                </button>
                            </div>
                        @endif
                    </div>
                @else
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        @foreach($feesData['fees_list'] as $fee)
                            @php
                                $isOverdue = $fee['status'] === 'overdue';
                                $dueDate = $fee['due_date'] ? \Carbon\Carbon::parse($fee['due_date']) : null;
                            @endphp
                            <div class="relative rounded-xl border-2 transition-all duration-200 hover:shadow-lg hover:scale-105
                                      {{ $isOverdue ? 'border-red-300 bg-gradient-to-br from-red-50 to-red-100' : 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100' }}">
                                
                                <!-- Status Badge -->
                                <div class="absolute -top-2 -right-2">
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm
                                               {{ $isOverdue ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white' }}">
                                        {{ ucfirst($fee['status']) }}
                                        @if($dueDate && $isOverdue)
                                            <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01"/>
                                            </svg>
                                        @endif
                                    </span>
                                </div>

                                <div class="p-4">
                                    <!-- Amount Display -->
                                    <div class="text-center mb-3">
                                        <p class="text-2xl font-bold text-gray-900">₹{{ number_format($fee['amount']) }}</p>
                                        @if($fee['late_fee'] > 0 || $fee['additional_charges'] > 0)
                                            <p class="text-xs text-gray-500 mt-1">
                                                @if($fee['late_fee'] > 0)
                                                    + Late Fee: ₹{{ number_format($fee['late_fee']) }}
                                                @endif
                                                @if($fee['additional_charges'] > 0)
                                                    + Additional: ₹{{ number_format($fee['additional_charges']) }}
                                                @endif
                                            </p>
                                        @endif
                                    </div>

                                    <!-- Fee Description -->
                                    <div class="text-center mb-3">
                                        <p class="text-sm font-medium text-gray-800 truncate" title="{{ $fee['description'] }}">
                                            {{ $fee['description'] }}
                                        </p>
                                        <p class="text-xs text-gray-600 mt-1">{{ $fee['batch'] }}</p>
                                        @if($fee['payment_for_month'])
                                            <p class="text-xs text-gray-500">For: {{ $fee['payment_for_month'] }}</p>
                                        @endif
                                    </div>

                                    <!-- Due Date Info -->
                                    @if($dueDate)
                                        <div class="text-center mb-3">
                                            <p class="text-sm font-medium text-gray-700">
                                                <span class="inline-flex items-center">
                                                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                    </svg>
                                                    Due: {{ $dueDate->format('M d, Y') }}
                                                </span>
                                            </p>
                                            @if($isOverdue)
                                                <p class="text-xs text-red-600 font-medium mt-1">
                                                    <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01"/>
                                                    </svg>
                                                    {{ $dueDate->diffInDays(now()) }} days overdue
                                                </p>
                                            @else
                                                <p class="text-xs text-blue-600 mt-1">
                                                    <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                    </svg>
                                                    {{ now()->diffInDays($dueDate) }} days left
                                                </p>
                                            @endif
                                        </div>
                                    @endif

                                    <!-- Notes -->
                                    @if(!empty($fee['notes']))
                                        <div class="mb-3 pt-2 border-t border-gray-200">
                                            <p class="text-xs text-gray-600 text-center">
                                                <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                                </svg>
                                                <span class="italic">{{ Str::limit($fee['notes'], 40) }}</span>
                                            </p>
                                        </div>
                                    @endif

                                    <!-- Actions -->
                                    <div class="space-y-2">
                                        <button class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-3 py-2 rounded-lg font-medium text-sm hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-sm hover:shadow-md">
                                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                                            </svg>
                                            Pay Now
                                        </button>
                                        <button class="w-full px-3 py-1 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                            </svg>
                                            Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
        </div>

        <!-- Payment History -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-medium text-gray-900">Payment History</h3>
                        <p class="text-sm text-gray-500 mt-1">
                            @if(empty($feesData['payment_history']))
                                No payment records found for {{ $selectedYear ?: 'this period' }}.
                            @else
                                {{ count($feesData['payment_history']) }} payment(s) in {{ $selectedYear ?: 'selected period' }}
                            @endif
                        </p>
                    </div>
                    @if(!empty($feesData['payment_history']))
                        <div class="flex items-center space-x-3">
                            <!-- Quick Actions for Large Datasets -->
                            @if(count($feesData['payment_history']) > 8)
                                <div class="flex items-center space-x-2">
                                    <button 
                                        type="button"
                                        onclick="document.getElementById('payment-history-grid').scrollIntoView({behavior: 'smooth'})"
                                        class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                                    >
                                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                        </svg>
                                        View {{ count($feesData['payment_history']) }} Payments
                                    </button>
                                </div>
                            @endif
                            
                            <div class="text-right">
                                <p class="text-sm font-medium text-gray-700">Total Paid</p>
                                <p class="text-lg font-bold text-emerald-600">₹{{ number_format($feesData['total_paid_this_year'] ?? 0) }}</p>
                            </div>
                        </div>
                    @endif
                </div>
            </div>
            <div class="p-6" id="payment-history-grid">
                @if(empty($feesData['payment_history']))
                    <div class="text-center py-12">
                        <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        <h3 class="mt-4 text-lg font-medium text-gray-900">No payment history</h3>
                        <p class="mt-2 text-sm text-gray-500">
                            @if($selectedYear)
                                No payments were recorded for {{ $selectedYear }}. Try selecting a different year.
                            @else
                                No payments have been recorded yet. Your payment history will appear here once you make payments.
                            @endif
                        </p>
                        
                        @if($selectedYear)
                            <div class="mt-6">
                                <button 
                                    type="button"
                                    wire:click="$set('selectedYear', '')"
                                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                    </svg>
                                    View All Years
                                </button>
                            </div>
                        @endif
                    </div>
                @else
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        @foreach($feesData['payment_history'] as $payment)
                            <div class="relative rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-100 transition-all duration-200 hover:shadow-lg hover:scale-105">
                                
                                <!-- Paid Badge -->
                                <div class="absolute -top-2 -right-2">
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-sm">
                                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                        </svg>
                                        Paid
                                    </span>
                                </div>

                                <div class="p-4">
                                    <!-- Amount Display -->
                                    <div class="text-center mb-3">
                                        <p class="text-2xl font-bold text-emerald-800">₹{{ number_format($payment['amount']) }}</p>
                                        @if($payment['discount_applied'] && $payment['discount_amount'] > 0)
                                            <p class="text-xs text-emerald-600 mt-1">
                                                Discount: ₹{{ number_format($payment['discount_amount']) }}
                                            </p>
                                        @endif
                                        @if(isset($payment['total_amount']) && $payment['total_amount'] != $payment['amount'])
                                            <p class="text-xs text-gray-500">
                                                Total: ₹{{ number_format($payment['total_amount']) }}
                                            </p>
                                        @endif
                                    </div>

                                    <!-- Payment Details -->
                                    <div class="text-center mb-3">
                                        <p class="text-sm font-medium text-gray-800 truncate" title="{{ $payment['description'] }}">
                                            {{ $payment['description'] }}
                                        </p>
                                        @if($payment['payment_for_month'])
                                            <p class="text-xs text-gray-600 mt-1">For: {{ $payment['payment_for_month'] }}</p>
                                        @endif
                                        @if($payment['months_covered'] > 1)
                                            <p class="text-xs text-emerald-600 font-medium">{{ $payment['months_covered'] }} months covered</p>
                                        @endif
                                    </div>

                                    <!-- Payment Date -->
                                    <div class="text-center mb-3">
                                        <p class="text-sm font-medium text-gray-700">
                                            <span class="inline-flex items-center">
                                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                                </svg>
                                                {{ \Carbon\Carbon::parse($payment['paid_date'])->format('M d, Y') }}
                                            </span>
                                        </p>
                                        <p class="text-xs text-gray-500">
                                            {{ \Carbon\Carbon::parse($payment['paid_date'])->diffForHumans() }}
                                        </p>
                                    </div>

                                    <!-- Payment Method & Collector -->
                                    <div class="text-center mb-3 space-y-1">
                                        <div class="flex items-center justify-center space-x-1">
                                            <svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                                            </svg>
                                            <span class="text-xs text-gray-600">{{ $payment['payment_method'] }}</span>
                                        </div>
                                        @if(!empty($payment['collected_by']))
                                            <div class="flex items-center justify-center space-x-1">
                                                <svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                                </svg>
                                                <span class="text-xs text-gray-600">{{ $payment['collected_by'] }}</span>
                                            </div>
                                        @endif
                                    </div>

                                    <!-- Receipt Number -->
                                    @if(!empty($payment['receipt_number']))
                                        <div class="mb-3 pt-2 border-t border-emerald-200">
                                            <p class="text-xs text-gray-600 text-center">
                                                <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                                </svg>
                                                Receipt: {{ $payment['receipt_number'] }}
                                            </p>
                                        </div>
                                    @endif

                                    <!-- Actions -->
                                    <div class="space-y-2">
                                        <button 
                                            wire:click="downloadReceipt({{ $payment['id'] }})"
                                            class="w-full bg-white text-emerald-700 border border-emerald-300 px-3 py-2 rounded-lg font-medium text-sm hover:bg-emerald-50 transition-all duration-200"
                                        >
                                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                            </svg>
                                            Download Receipt
                                        </button>
                                        <button class="w-full px-3 py-1 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                            </svg>
                                            Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        @endforeach
                    </div>
                @endif
            </div>
        </div>
    </div>
</x-filament-panels::page>
