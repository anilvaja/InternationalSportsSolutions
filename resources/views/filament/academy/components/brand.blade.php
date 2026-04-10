@php
    $user = auth()->user();
    $academy = null;
    
    if ($user && $user->academy_id) {
        $academy = $user->academy ?? \App\Models\Academy::find($user->academy_id);
    }
@endphp

<div class="flex items-center gap-3">
    @if($academy && $academy->logo)
        <img 
            src="{{ \Illuminate\Support\Facades\Storage::url($academy->logo) }}" 
            alt="{{ $academy->name ?? 'Academy' }} Logo"
            class="h-8 w-8 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
        >
    @else
        <div class="h-8 w-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m11 0a2 2 0 01-2 2H5a2 2 0 01-2-2m0 0V9a2 2 0 012-2h2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10v6H7V7z"/>
            </svg>
        </div>
    @endif
    
    <span class="font-semibold text-gray-900 dark:text-white text-sm">
        {{ $academy->name ?? 'Academy Dashboard' }}
    </span>
</div>
