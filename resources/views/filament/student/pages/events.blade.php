<x-filament-panels::page>
    <div class="space-y-6">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
            <h1 class="text-2xl font-bold mb-2">Academy Events</h1>
            <p class="text-blue-100">Stay updated with upcoming events and activities. Respond to invitations and manage your participation.</p>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            @php
                $student = auth('student')->user();
                $totalEvents = \App\Models\Event::where('academy_id', $student->academy_id)
                    ->where('status', 'published')
                    ->where('event_date', '>', now())
                    ->count();
                    
                $myParticipations = \App\Models\EventParticipant::where('student_id', $student->id)
                    ->whereHas('event', fn($q) => $q->where('event_date', '>', now()))
                    ->count();
                    
                $interestedEvents = \App\Models\EventParticipant::where('student_id', $student->id)
                    ->where('status', 'interested')
                    ->whereHas('event', fn($q) => $q->where('event_date', '>', now()))
                    ->count();
                    
                $attendedEvents = \App\Models\EventParticipant::where('student_id', $student->id)
                    ->where('status', 'attended')
                    ->count();
            @endphp
            
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center">
                    <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Upcoming Events</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ $totalEvents }}</p>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center">
                    <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Interested</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ $interestedEvents }}</p>
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
                        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">My Invitations</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ $myParticipations }}</p>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center">
                    <div class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                        <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Attended</p>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ $attendedEvents }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Events Table -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Available Events</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Click on events to view details and respond to invitations</p>
            </div>
            
            <div class="p-6">
                {{ $this->table }}
            </div>
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
                    <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">Event Participation Guide</h3>
                    <div class="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        <ul class="space-y-1">
                            <li>• Respond to event invitations by clicking "I'm Interested" or "Not Interested"</li>
                            <li>• You can change your response before the RSVP deadline</li>
                            <li>• Check event details for location, timing, and any fees involved</li>
                            <li>• Contact academy administration if you have questions about an event</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-filament-panels::page>
