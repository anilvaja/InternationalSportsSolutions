<x-filament::widget>
    <x-filament::card>
        <h2 class="text-lg font-bold mb-2">Syllabus & Techniques</h2>
        <div class="mb-2">
            <span class="font-semibold">Categories:</span> {{ $categories->count() }}
            <a href="{{ route('filament.admin.resources.syllabus-categories.index', ['tableFilters[academy_id][value]' => $record->id]) }}" class="ml-2 text-primary-600 underline">View</a>
        </div>
        <div>
            <span class="font-semibold">Techniques:</span> {{ $techniques->count() }}
            <a href="{{ route('filament.admin.resources.syllabus-techniques.index', ['tableFilters[academy_id][value]' => $record->id]) }}" class="ml-2 text-primary-600 underline">View</a>
        </div>
    </x-filament::card>
</x-filament::widget>
