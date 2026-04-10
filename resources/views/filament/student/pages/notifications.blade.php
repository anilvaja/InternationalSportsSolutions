<x-filament-panels::page>
    <div class="space-y-6">
        <!-- Header Section -->
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-xl font-semibold text-gray-900">My Notifications</h2>
                <p class="text-sm text-gray-600">
                    Stay updated with important announcements and reminders
                    @if($unreadCount > 0)
                        <span class="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {{ $unreadCount }} new
                        </span>
                    @endif
                </p>
            </div>
            
            @if($unreadCount > 0)
                <button wire:click="markAllAsRead" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    Mark All as Read
                </button>
            @endif
        </div>

        <!-- Notifications List -->
        <div class="space-y-4">
            @forelse($notifications as $notification)
                <div class="bg-white rounded-lg border border-gray-200 overflow-hidden 
                          {{ !$notification['read_at'] ? 'ring-2 ring-blue-100' : '' }}">
                    <div class="p-6">
                        <div class="flex items-start space-x-4">
                            <!-- Icon -->
                            <div class="flex-shrink-0">
                                @php
                                    $iconClasses = match($notification['type']) {
                                        'fee_reminder' => 'bg-red-100 text-red-600',
                                        'attendance_alert' => 'bg-yellow-100 text-yellow-600',
                                        'achievement' => 'bg-green-100 text-green-600',
                                        'schedule_change' => 'bg-blue-100 text-blue-600',
                                        default => 'bg-gray-100 text-gray-600'
                                    };
                                @endphp
                                <div class="w-10 h-10 rounded-full flex items-center justify-center {{ $iconClasses }}">
                                    @switch($notification['type'])
                                        @case('fee_reminder')
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                                            </svg>
                                            @break
                                        @case('attendance_alert')
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                                            </svg>
                                            @break
                                        @case('achievement')
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                                            </svg>
                                            @break
                                        @case('schedule_change')
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                            </svg>
                                            @break
                                        @default
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                            </svg>
                                    @endswitch
                                </div>
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                    <h3 class="text-base font-semibold text-gray-900">
                                        {{ $notification['title'] }}
                                        @if(!$notification['read_at'])
                                            <span class="ml-2 w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                                        @endif
                                    </h3>
                                    <div class="flex items-center space-x-2">
                                        <!-- Priority Badge -->
                                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                                   {{ $notification['priority'] === 'high' ? 'bg-red-100 text-red-800' : 
                                                      ($notification['priority'] === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800') }}">
                                            {{ ucfirst($notification['priority']) }}
                                        </span>
                                        <!-- Mark as Read Button -->
                                        @if(!$notification['read_at'])
                                            <button wire:click="markAsRead({{ $notification['id'] }})"
                                                    class="text-blue-600 hover:text-blue-800 text-sm">
                                                Mark as read
                                            </button>
                                        @endif
                                    </div>
                                </div>
                                <p class="mt-2 text-sm text-gray-600">
                                    {{ $notification['message'] }}
                                </p>
                                <p class="mt-2 text-xs text-gray-500">
                                    {{ $notification['created_at']->diffForHumans() }}
                                    @if($notification['read_at'])
                                        • Read {{ $notification['read_at']->diffForHumans() }}
                                    @endif
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            @empty
                <div class="text-center py-12">
                    <div class="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 1 0-15 0v5"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
                    <p class="text-sm text-gray-500">You'll receive important updates and announcements here</p>
                </div>
            @endforelse
        </div>
    </div>
</x-filament-panels::page>
