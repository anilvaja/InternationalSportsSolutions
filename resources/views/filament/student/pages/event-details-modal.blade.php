<div class="space-y-6">
    @if($record->image)
        <div class="rounded-lg overflow-hidden">
            <img src="{{ Storage::url($record->image) }}" alt="{{ $record->title }}" class="w-full h-48 object-cover">
        </div>
    @endif

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Event Details -->
        <div class="space-y-4">
            <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Event Details</h3>
                <div class="space-y-2 text-sm">
                    <div class="flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span class="text-gray-600 dark:text-gray-400">Date:</span>
                        <span class="ml-1 font-medium">{{ $record->event_date->format('d M Y, H:i') }}</span>
                    </div>

                    @if($record->event_end_date)
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <span class="text-gray-600 dark:text-gray-400">Ends:</span>
                            <span class="ml-1 font-medium">{{ $record->event_end_date->format('d M Y, H:i') }}</span>
                        </div>
                    @endif

                    @if($record->location)
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                            <span class="text-gray-600 dark:text-gray-400">Location:</span>
                            <span class="ml-1 font-medium">{{ $record->location }}</span>
                        </div>
                    @endif

                    @if($record->venue)
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                            </svg>
                            <span class="text-gray-600 dark:text-gray-400">Venue:</span>
                            <span class="ml-1 font-medium">{{ $record->venue }}</span>
                        </div>
                    @endif

                    @if($record->fee > 0)
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                            </svg>
                            <span class="text-gray-600 dark:text-gray-400">Fee:</span>
                            <span class="ml-1 font-medium text-green-600">₹{{ number_format($record->fee, 2) }}</span>
                        </div>
                    @endif

                    @if($record->max_participants)
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                            </svg>
                            <span class="text-gray-600 dark:text-gray-400">Max Participants:</span>
                            <span class="ml-1 font-medium">{{ $record->max_participants }}</span>
                        </div>
                    @endif

                    @if($record->rsvp_deadline && $record->requires_rsvp)
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3l3 3m-3-3h3m-3-3V6a3 3 0 013-3h3a3 3 0 013 3v3"/>
                            </svg>
                            <span class="text-gray-600 dark:text-gray-400">RSVP Deadline:</span>
                            <span class="ml-1 font-medium text-orange-600">{{ $record->rsvp_deadline->format('d M Y, H:i') }}</span>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <!-- Participation Status -->
        <div class="space-y-4">
            <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Your Participation</h3>
                
                @php
                    $participant = $record->participants->first();
                @endphp
                
                @if($participant)
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                {{ $participant->status === 'interested' ? 'bg-green-100 text-green-800' : 
                                   ($participant->status === 'not_interested' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800') }}">
                                {{ $participant->status_label }}
                            </span>
                        </div>
                        
                        @if($participant->responded_at)
                            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Responded: {{ $participant->responded_at->format('d M Y, H:i') }}
                            </div>
                        @endif
                        
                        @if($participant->response_notes)
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                                <span class="font-medium">Notes:</span> {{ $participant->response_notes }}
                            </div>
                        @endif
                        
                        @if($record->fee > 0 && $participant->payment_required)
                            <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Payment:</span>
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                        {{ $participant->payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800' }}">
                                        {{ ucfirst($participant->payment_status ?? 'pending') }}
                                    </span>
                                </div>
                            </div>
                        @endif
                    </div>
                @else
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <p class="text-sm text-gray-600 dark:text-gray-400">You have not been invited to this event or are not eligible based on the event criteria.</p>
                    </div>
                @endif
            </div>

            <!-- Participation Stats -->
            <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Event Statistics</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div class="bg-green-50 dark:bg-green-900/20 rounded p-2 text-center">
                        <div class="font-medium text-green-800 dark:text-green-200">{{ $record->interestedParticipants()->count() }}</div>
                        <div class="text-green-600 dark:text-green-400 text-xs">Interested</div>
                    </div>
                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded p-2 text-center">
                        <div class="font-medium text-blue-800 dark:text-blue-200">{{ $record->participants()->count() }}</div>
                        <div class="text-blue-600 dark:text-blue-400 text-xs">Total Invited</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Event Description -->
    @if($record->content)
        <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">About This Event</h3>
            <div class="prose dark:prose-invert max-w-none">
                {!! $record->content !!}
            </div>
        </div>
    @elseif($record->description)
        <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">About This Event</h3>
            <p class="text-gray-600 dark:text-gray-400">{{ $record->description }}</p>
        </div>
    @endif

    <!-- Attachments -->
    @if($record->attachments && count($record->attachments) > 0)
        <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Attachments</h3>
            <div class="space-y-2">
                @foreach($record->attachments as $attachment)
                    <a href="{{ Storage::url($attachment) }}" 
                       target="_blank"
                       class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        {{ basename($attachment) }}
                    </a>
                @endforeach
            </div>
        </div>
    @endif
</div>
