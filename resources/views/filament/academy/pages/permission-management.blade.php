<x-filament-panels::page>
    <div class="space-y-6">
        <!-- Roles Overview Table -->
        <div class="mb-8">
            {{ $this->table }}
        </div>

        <!-- Permission Matrix -->
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-medium text-gray-900">Permission Matrix</h3>
                <p class="text-sm text-gray-500">Click on checkboxes to toggle permissions for each role</p>
            </div>
            
            <div class="p-6">
                @if(!empty($permissionMatrix))
                    @foreach($permissionMatrix as $category => $permissions)
                        <div class="mb-8">
                            <h4 class="text-base font-semibold text-gray-900 mb-4 capitalize border-b pb-2">
                                {{ str_replace('_', ' ', $category) }}
                            </h4>
                            
                            <div class="overflow-x-auto">
                                <table class="min-w-full table-auto">
                                    <thead>
                                        <tr>
                                            <th class="text-left py-2 px-3 font-medium text-gray-700 w-1/3">Permission</th>
                                            @php
                                                $roles = collect($permissions)->first()['roles'] ?? [];
                                            @endphp
                                            @foreach($roles as $roleId => $roleData)
                                                <th class="text-center py-2 px-3 font-medium text-gray-700">
                                                    {{ $roleData['name'] }}
                                                </th>
                                            @endforeach
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach($permissions as $permissionName => $permissionData)
                                            <tr class="border-t border-gray-100 hover:bg-gray-50">
                                                <td class="py-3 px-3">
                                                    <div>
                                                        <div class="font-medium text-gray-900">
                                                            {{ $permissionData['display_name'] }}
                                                        </div>
                                                        @if($permissionData['description'])
                                                            <div class="text-sm text-gray-500">
                                                                {{ $permissionData['description'] }}
                                                            </div>
                                                        @endif
                                                    </div>
                                                </td>
                                                @foreach($permissionData['roles'] as $roleId => $roleData)
                                                    <td class="text-center py-3 px-3">
                                                        <input 
                                                            type="checkbox" 
                                                            @if($roleData['has_permission']) checked @endif
                                                            wire:click="togglePermission('{{ $roleId }}', '{{ $permissionName }}')"
                                                            class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 cursor-pointer"
                                                        />
                                                    </td>
                                                @endforeach
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    @endforeach
                @else
                    <div class="text-center py-8">
                        <div class="text-gray-500">No permissions found</div>
                    </div>
                @endif
            </div>
        </div>

        <!-- Permission Statistics -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="text-3xl font-bold text-blue-600">
                    {{ collect($permissionMatrix)->flatten(2)->count() }}
                </div>
                <div class="text-sm text-gray-500">Total Permissions</div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="text-3xl font-bold text-green-600">
                    {{ count($permissionMatrix) }}
                </div>
                <div class="text-sm text-gray-500">Permission Categories</div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                @php
                    $totalAssigned = 0;
                    foreach($permissionMatrix as $category => $permissions) {
                        foreach($permissions as $permission => $data) {
                            foreach($data['roles'] as $roleId => $roleData) {
                                if($roleData['has_permission']) {
                                    $totalAssigned++;
                                }
                            }
                        }
                    }
                @endphp
                <div class="text-3xl font-bold text-purple-600">
                    {{ $totalAssigned }}
                </div>
                <div class="text-sm text-gray-500">Assigned Permissions</div>
            </div>
        </div>
    </div>
</x-filament-panels::page>
