@extends('prints.layout')

@section('content')
<div class="section">
    <div class="section-title">Academy Roles</div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 20%;">Role Name</th>
                <th style="width: 20%;">Display Name</th>
                <th style="width: 35%;">Description</th>
                <th style="width: 15%;">Users Count</th>
                <th style="width: 10%;">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($roles as $role)
                <tr>
                    <td style="font-family: monospace; font-size: 12px;">{{ $role->name }}</td>
                    <td>{{ $role->display_name }}</td>
                    <td>{{ $role->description ?? 'No description available' }}</td>
                    <td>{{ $role->users_count }}</td>
                    <td>
                        <span class="badge badge-{{ $role->is_active ? 'success' : 'danger' }}">
                            {{ $role->is_active ? 'Active' : 'Inactive' }}
                        </span>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

@foreach($roles as $role)
    @if($role->permissions && is_array($role->permissions) && count($role->permissions) > 0)
        <div class="section">
            <div class="section-title">{{ $role->display_name }} - Permissions</div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0;">
                @foreach($role->permissions as $permission)
                    <span class="badge badge-primary">{{ str_replace('_', ' ', $permission) }}</span>
                @endforeach
            </div>
            
            @php
                $permissionsByCategory = collect($role->permissions)->mapWithKeys(function ($permission) {
                    // Try to determine category from permission name
                    $parts = explode('_', $permission);
                    if (count($parts) > 1) {
                        $category = $parts[1]; // e.g., 'view_users' -> 'users'
                        return [$permission => $category];
                    }
                    return [$permission => 'general'];
                })->groupBy(function ($category) {
                    return $category;
                });
            @endphp
            
            @if($permissionsByCategory->count() > 1)
                <table style="margin-top: 15px;">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Permissions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($permissionsByCategory as $category => $permissions)
                            <tr>
                                <td>{{ ucwords(str_replace('_', ' ', $category)) }}</td>
                                <td>
                                    @foreach($permissions->keys() as $permission)
                                        <span class="badge">{{ str_replace('_', ' ', $permission) }}</span>
                                    @endforeach
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @endif
        </div>
        
        @if(!$loop->last)
            <div class="page-break"></div>
        @endif
    @endif
@endforeach

<div class="section">
    <div class="section-title">Role Summary</div>
    <table>
        <thead>
            <tr>
                <th>Role</th>
                <th>Users</th>
                <th>Permissions</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($roles as $role)
                <tr>
                    <td>{{ $role->display_name }}</td>
                    <td>{{ $role->users_count }}</td>
                    <td>{{ is_array($role->permissions) ? count($role->permissions) : 0 }}</td>
                    <td>
                        <span class="badge badge-{{ $role->is_active ? 'success' : 'danger' }}">
                            {{ $role->is_active ? 'Active' : 'Inactive' }}
                        </span>
                    </td>
                </tr>
            @endforeach
            <tr style="font-weight: bold; background-color: #f3f4f6;">
                <td>Total Roles</td>
                <td>{{ $roles->sum('users_count') }}</td>
                <td>{{ $roles->sum(function ($role) { return is_array($role->permissions) ? count($role->permissions) : 0; }) }}</td>
                <td>{{ $roles->where('is_active', true)->count() }} Active</td>
            </tr>
        </tbody>
    </table>
</div>
@endsection
