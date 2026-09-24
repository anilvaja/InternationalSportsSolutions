<x-filament-widgets::widget>
    <x-filament::section class="border-gray-200 dark:border-gray-800">
        @php
            $quickLinks = $this->getQuickLinks();
        @endphp

        <div class="space-y-3">
            {{-- Header Row --}}
            <div class="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div class="flex items-center space-x-2">
                    <div class="p-1.5 bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 rounded-lg">
                        <x-heroicon-o-squares-2x2 class="w-4 h-4" />
                    </div>
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white">
                        Quick Access Launchpad
                    </h3>
                </div>
                <span class="text-xs text-gray-400 dark:text-gray-500 font-medium hidden sm:inline">
                    Direct Navigation & Action Shortcuts
                </span>
            </div>

            {{-- Launchpad Tiles Grid --}}
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                @foreach($quickLinks as $item)
                    <div class="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-xs hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md transition-all flex flex-col justify-between group">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <div class="p-2 rounded-lg {{ $item['bg_light'] }} {{ $item['text_color'] }} group-hover:scale-105 transition-transform">
                                    @switch($item['icon'])
                                        @case('heroicon-o-clipboard-document-check')
                                            <x-heroicon-o-clipboard-document-check class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-clock')
                                            <x-heroicon-o-clock class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-academic-cap')
                                            <x-heroicon-o-academic-cap class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-rectangle-stack')
                                            <x-heroicon-o-rectangle-stack class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-banknotes')
                                            <x-heroicon-o-banknotes class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-calendar-days')
                                            <x-heroicon-o-calendar-days class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-identification')
                                            <x-heroicon-o-identification class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-book-open')
                                            <x-heroicon-o-book-open class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-building-office')
                                            <x-heroicon-o-building-office class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-sun')
                                            <x-heroicon-o-sun class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-trophy')
                                            <x-heroicon-o-trophy class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-key')
                                            <x-heroicon-o-key class="w-5 h-5" />
                                            @break
                                        @case('heroicon-o-cog-6-tooth')
                                            <x-heroicon-o-cog-6-tooth class="w-5 h-5" />
                                            @break
                                        @default
                                            <x-heroicon-o-folder class="w-5 h-5" />
                                    @endswitch
                                </div>

                                @if(!empty($item['badge']))
                                    <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                        {{ $item['badge'] }}
                                    </span>
                                @endif
                            </div>

                            <a href="{{ $item['url'] }}" class="block">
                                <h4 class="text-xs font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">
                                    {{ $item['title'] }}
                                </h4>
                                <p class="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                                    {{ $item['description'] }}
                                </p>
                            </a>
                        </div>

                        <div class="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px]">
                            <a href="{{ $item['url'] }}" class="font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-0.5">
                                <span>Open</span>
                                <x-heroicon-m-chevron-right class="w-3 h-3" />
                            </a>

                            @if(($item['can_create'] ?? false) && !empty($item['create_url']))
                                <a href="{{ $item['create_url'] }}" class="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                                    {{ $item['create_label'] }}
                                </a>
                            @endif
                        </div>
                    </div>
                @endforeach
            </div>
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
