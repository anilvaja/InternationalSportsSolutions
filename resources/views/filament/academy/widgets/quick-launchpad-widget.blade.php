<x-filament-widgets::widget>
    <x-filament::section class="border-gray-200 dark:border-gray-800">
        @php
            $quickLinks = $this->getQuickLinks();
            $featuredLinks = array_filter($quickLinks, fn($l) => $l['featured'] ?? false);
            $standardLinks = array_filter($quickLinks, fn($l) => !($l['featured'] ?? false));
        @endphp

        <div class="space-y-4">
            {{-- Header Row --}}
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div class="flex items-center space-x-2.5">
                    <div class="p-2 bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-lg">
                        <x-heroicon-o-squares-2x2 class="w-5 h-5" />
                    </div>
                    <div>
                        <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Quick Access Launchpad</span>
                            <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-semibold bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
                                Direct Shortcuts
                            </span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            Directly jump to any module or trigger common daily tasks without using side navigation.
                        </p>
                    </div>
                </div>
            </div>

            {{-- 1. Featured Action Cards Grid --}}
            @if(count($featuredLinks) > 0)
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    @foreach($featuredLinks as $item)
                        <div class="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between">
                            <div>
                                <div class="flex items-start justify-between gap-2">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2.5 rounded-xl {{ $item['bg_light'] }} {{ $item['text_color'] }} group-hover:scale-105 transition-transform">
                                            @switch($item['icon'])
                                                @case('heroicon-o-clipboard-document-check')
                                                    <x-heroicon-o-clipboard-document-check class="w-6 h-6" />
                                                    @break
                                                @case('heroicon-o-clock')
                                                    <x-heroicon-o-clock class="w-6 h-6" />
                                                    @break
                                                @case('heroicon-o-academic-cap')
                                                    <x-heroicon-o-academic-cap class="w-6 h-6" />
                                                    @break
                                                @case('heroicon-o-rectangle-stack')
                                                    <x-heroicon-o-rectangle-stack class="w-6 h-6" />
                                                    @break
                                                @case('heroicon-o-banknotes')
                                                    <x-heroicon-o-banknotes class="w-6 h-6" />
                                                    @break
                                                @case('heroicon-o-calendar-days')
                                                    <x-heroicon-o-calendar-days class="w-6 h-6" />
                                                    @break
                                                @default
                                                    <x-heroicon-o-folder class="w-6 h-6" />
                                            @endswitch
                                        </div>
                                        <div>
                                            <a href="{{ $item['url'] }}" class="text-sm font-bold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                                                {{ $item['title'] }}
                                            </a>
                                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {{ $item['description'] }}
                                            </p>
                                        </div>
                                    </div>

                                    @if(!empty($item['badge']))
                                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                            {{ $item['badge'] }}
                                        </span>
                                    @endif
                                </div>
                            </div>

                            <div class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                                <a href="{{ $item['url'] }}" class="font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                                    <span>View Section</span>
                                    <x-heroicon-m-chevron-right class="w-3.5 h-3.5" />
                                </a>

                                @if(($item['can_create'] ?? false) && !empty($item['create_url']))
                                    <a href="{{ $item['create_url'] }}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold {{ $item['btn_bg'] }} transition-colors">
                                        {{ $item['create_label'] }}
                                    </a>
                                @endif
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif

            {{-- 2. All Modules Quick Shortcuts Bar --}}
            @if(count($standardLinks) > 0)
                <div class="pt-2">
                    <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
                        More Academy Modules
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        @foreach($standardLinks as $item)
                            <a href="{{ $item['url'] }}" class="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-sm transition-all flex items-center space-x-3 group">
                                <div class="p-2 rounded-lg {{ $item['bg_light'] }} {{ $item['text_color'] }} group-hover:scale-105 transition-transform shrink-0">
                                    @switch($item['icon'])
                                        @case('heroicon-o-identification')
                                            <x-heroicon-o-identification class="w-4 h-4" />
                                            @break
                                        @case('heroicon-o-book-open')
                                            <x-heroicon-o-book-open class="w-4 h-4" />
                                            @break
                                        @case('heroicon-o-building-office')
                                            <x-heroicon-o-building-office class="w-4 h-4" />
                                            @break
                                        @case('heroicon-o-sun')
                                            <x-heroicon-o-sun class="w-4 h-4" />
                                            @break
                                        @case('heroicon-o-trophy')
                                            <x-heroicon-o-trophy class="w-4 h-4" />
                                            @break
                                        @case('heroicon-o-key')
                                            <x-heroicon-o-key class="w-4 h-4" />
                                            @break
                                        @case('heroicon-o-cog-6-tooth')
                                            <x-heroicon-o-cog-6-tooth class="w-4 h-4" />
                                            @break
                                        @default
                                            <x-heroicon-o-folder class="w-4 h-4" />
                                    @endswitch
                                </div>
                                <div class="truncate">
                                    <div class="text-xs font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">
                                        {{ $item['title'] }}
                                    </div>
                                    <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                        {{ $item['description'] }}
                                    </div>
                                </div>
                            </a>
                        @endforeach
                    </div>
                </div>
            @endif
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
