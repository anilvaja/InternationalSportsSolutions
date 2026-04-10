@php
    $user = auth()->user();
@endphp

<div class="flex items-center gap-2">
    @if($user && $user->avatar)
        <img 
            src="{{ \Illuminate\Support\Facades\Storage::url($user->avatar) }}" 
            alt="{{ $user->name }} Avatar"
            class="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-600"
        >
    @else
        <div class="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-sm">
            {{ strtoupper(substr($user->name ?? 'U', 0, 1)) }}
        </div>
    @endif
    
    <span class="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:block">
        {{ $user->name ?? 'User' }}
    </span>
</div>
