<x-filament-widgets::widget>
    @php
        $items = $this->getAttentionItems();
    @endphp

    @if(count($items) > 0)
        <div class="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div class="flex items-center space-x-2">
                    <div class="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
                        <x-heroicon-o-exclamation-triangle class="w-4 h-4" />
                    </div>
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>Attention Required</span>
                        <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                            {{ count($items) }} Actions Pending
                        </span>
                    </h3>
                </div>
                <span class="text-xs text-gray-400 dark:text-gray-500 font-medium hidden sm:inline">
                    Items requiring immediate administrative decision today
                </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                @foreach($items as $item)
                    <div class="p-3.5 rounded-xl border {{ $item['bg_color'] }} flex items-start justify-between gap-3 shadow-xs hover:shadow-sm transition-all group">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-extrabold px-2 py-0.5 rounded-full {{ $item['badge_bg'] }}">
                                    {{ $item['count'] }}
                                </span>
                                <h4 class="text-xs font-bold {{ $item['text_color'] }}">
                                    {{ $item['title'] }}
                                </h4>
                            </div>
                            <p class="text-[11px] text-gray-600 dark:text-gray-300">
                                {{ $item['label'] }}
                            </p>
                            <a href="{{ $item['url'] }}" class="inline-flex items-center gap-1 text-xs font-bold text-gray-900 dark:text-white hover:underline pt-1">
                                <span>{{ $item['action_label'] }}</span>
                                <x-heroicon-m-chevron-right class="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                @endforeach
            </div>
        </div>
    @endif
</x-filament-widgets::widget>
