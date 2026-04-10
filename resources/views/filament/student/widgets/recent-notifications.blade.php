<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">
            Recent Notifications
        </x-slot>

        <div class="space-y-3">
            @forelse($notifications as $notification)
                <div class="flex items-start space-x-3 p-3 rounded-lg 
                          {{ $notification->read_at ? 'bg-gray-50' : 'bg-blue-50' }}">
                    <div class="flex-shrink-0">
                        @if(!$notification->read_at)
                            <div class="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        @else
                            <div class="w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                        @endif
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm {{ $notification->read_at ? 'text-gray-600' : 'text-gray-900 font-medium' }}">
                            {{ $notification->data['message'] ?? 'New notification' }}
                        </p>
                        <p class="text-xs text-gray-500 mt-1">
                            {{ $notification->created_at->diffForHumans() }}
                        </p>
                    </div>
                </div>
            @empty
                <div class="text-center py-6">
                    <div class="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 1 0-15 0v5"/>
                        </svg>
                    </div>
                    <p class="mt-2 text-sm text-gray-500">No notifications yet</p>
                    <p class="text-xs text-gray-400">You'll see important updates here</p>
                </div>
            @endforelse
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
