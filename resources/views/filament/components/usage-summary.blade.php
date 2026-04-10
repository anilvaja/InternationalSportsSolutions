<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
    <!-- Users Usage -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium text-gray-600 dark:text-gray-400">Users</h4>
            <span class="text-xs text-gray-500">{{ $users['percent'] }}%</span>
        </div>
        <div class="flex items-center justify-between mb-2">
            <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ $users['current'] }}</span>
            <span class="text-sm text-gray-500">/ {{ $users['max'] ?? '∞' }}</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-blue-500 h-2 rounded-full" style="width: {{ min($users['percent'], 100) }}%"></div>
        </div>
    </div>

    <!-- Students Usage -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium text-gray-600 dark:text-gray-400">Students</h4>
            <span class="text-xs text-gray-500">{{ $students['percent'] }}%</span>
        </div>
        <div class="flex items-center justify-between mb-2">
            <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ $students['current'] }}</span>
            <span class="text-sm text-gray-500">/ {{ $students['max'] ?? '∞' }}</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-green-500 h-2 rounded-full" style="width: {{ min($students['percent'], 100) }}%"></div>
        </div>
    </div>

    <!-- Branches Usage -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium text-gray-600 dark:text-gray-400">Branches</h4>
            <span class="text-xs text-gray-500">{{ $branches['percent'] }}%</span>
        </div>
        <div class="flex items-center justify-between mb-2">
            <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ $branches['current'] }}</span>
            <span class="text-sm text-gray-500">/ {{ $branches['max'] ?? '∞' }}</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="{{ $branches['percent'] >= 100 ? 'bg-red-500' : ($branches['percent'] >= 80 ? 'bg-yellow-500' : 'bg-purple-500') }} h-2 rounded-full" 
                 style="width: {{ min($branches['percent'], 100) }}%"></div>
        </div>
    </div>

    <!-- Coaches Usage -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium text-gray-600 dark:text-gray-400">Coaches</h4>
            <span class="text-xs text-gray-500">{{ $coaches['percent'] }}%</span>
        </div>
        <div class="flex items-center justify-between mb-2">
            <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ $coaches['current'] }}</span>
            <span class="text-sm text-gray-500">/ {{ $coaches['max'] ?? '∞' }}</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-orange-500 h-2 rounded-full" style="width: {{ min($coaches['percent'], 100) }}%"></div>
        </div>
    </div>
</div>
