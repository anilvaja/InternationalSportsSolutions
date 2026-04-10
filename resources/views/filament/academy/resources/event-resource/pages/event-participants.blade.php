<x-filament-panels::page>
    <style>
        @media print {
            /* Hide navigation and sidebar */
            .fi-sidebar, .fi-topbar, .fi-header-actions, .fi-breadcrumbs {
                display: none !important;
            }
            
            /* Hide action buttons in print */
            .fi-ta-header-actions, .print-hide {
                display: none !important;
            }
            
            /* Adjust print layout */
            .fi-main {
                margin: 0 !important;
                padding: 0 !important;
            }
            
            /* Make cards print-friendly */
            .bg-white, .dark\\:bg-gray-800 {
                background: white !important;
                box-shadow: none !important;
                border: 1px solid #ddd !important;
            }
            
            /* Ensure text is black for print */
            .text-white, .dark\\:text-white, .text-gray-900, .dark\\:text-gray-900 {
                color: black !important;
            }
            
            .text-gray-600, .dark\\:text-gray-400 {
                color: #666 !important;
            }
            
            /* Adjust gradient header for print */
            .bg-gradient-to-r {
                background: #f8f9fa !important;
                color: black !important;
            }
            
            /* Make badges print-friendly */
            .bg-white\/20 {
                background: #e5e7eb !important;
                color: black !important;
            }
        }
    </style>
    
    <div class="space-y-6">
        <!-- Event Details Card -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold text-white">{{ $this->record->title }}</h2>
                        <p class="text-blue-100">{{ $this->record->event_date->format('d M Y, H:i') }}</p>
                    </div>
                    <div class="flex space-x-2">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                            {{ ucfirst($this->record->type) }}
                        </span>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                            {{ ucfirst($this->record->status) }}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Invited</div>
                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
                            {{ $this->record->participants()->count() }}
                        </div>
                    </div>
                    
                    <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <div class="text-sm font-medium text-green-600 dark:text-green-400">Interested</div>
                        <div class="text-2xl font-bold text-green-900 dark:text-green-100">
                            {{ $this->record->interestedParticipants()->count() }}
                        </div>
                    </div>
                    
                    <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                        <div class="text-sm font-medium text-red-600 dark:text-red-400">Not Interested</div>
                        <div class="text-2xl font-bold text-red-900 dark:text-red-100">
                            {{ $this->record->notInterestedParticipants()->count() }}
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <div class="text-sm font-medium text-blue-600 dark:text-blue-400">Attended</div>
                        <div class="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {{ $this->record->attendedParticipants()->count() }}
                        </div>
                    </div>
                </div>
                
                @if($this->record->description)
                    <div class="mb-4">
                        <h3 class="font-medium text-gray-900 dark:text-white mb-2">Event Description</h3>
                        <p class="text-gray-600 dark:text-gray-400">{{ $this->record->description }}</p>
                    </div>
                @endif
                
                @if($this->record->location || $this->record->venue)
                    <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                        @if($this->record->location)
                            <span class="flex items-center">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                                </svg>
                                {{ $this->record->location }}
                            </span>
                        @endif
                        
                        @if($this->record->venue)
                            <span class="flex items-center">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                                </svg>
                                {{ $this->record->venue }}
                            </span>
                        @endif
                    </div>
                @endif
            </div>
        </div>

        <!-- Participants Table -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Event Participants</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Manage student responses and attendance</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button 
                            onclick="window.print()" 
                            class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                            </svg>
                            Quick Print
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="p-6">
                {{ $this->table }}
            </div>
        </div>
    </div>
</x-filament-panels::page>
