@extends('prints.layout')

@section('content')
<div class="section">
    <div class="section-title">Academy Users</div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 25%;">Name</th>
                <th style="width: 30%;">Email</th>
                <th style="width: 15%;">Phone</th>
                <th style="width: 15%;">Role</th>
                <th style="width: 15%;">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($users as $user)
                <tr>
                    <td>{{ $user->name }}</td>
                    <td>{{ $user->email }}</td>
                    <td>{{ $user->phone ?? 'N/A' }}</td>
                    <td>
                        @php
                            $role = $user->activeAcademyRoles->first()?->academyRole;
                        @endphp
                        {{ $role ? $role->display_name : 'No Role' }}
                    </td>
                    <td>
                        <span class="badge badge-{{ $user->status === 'active' ? 'success' : ($user->status === 'inactive' ? 'warning' : 'danger') }}">
                            {{ ucfirst($user->status) }}
                        </span>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

<div class="section">
    <div class="section-title">User Statistics</div>
    <table>
        <thead>
            <tr>
                <th>Status</th>
                <th>Count</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Active Users</td>
                <td>{{ $users->where('status', 'active')->count() }}</td>
            </tr>
            <tr>
                <td>Inactive Users</td>
                <td>{{ $users->where('status', 'inactive')->count() }}</td>
            </tr>
            <tr>
                <td>Suspended Users</td>
                <td>{{ $users->where('status', 'suspended')->count() }}</td>
            </tr>
            <tr style="font-weight: bold; background-color: #f3f4f6;">
                <td>Total Users</td>
                <td>{{ $users->count() }}</td>
            </tr>
        </tbody>
    </table>
</div>

@if($users->isNotEmpty())
<div class="section">
    <div class="section-title">Role Distribution</div>
    <table>
        <thead>
            <tr>
                <th>Role</th>
                <th>User Count</th>
            </tr>
        </thead>
        <tbody>
            @php
                $roleDistribution = $users->map(function ($user) {
                    $role = $user->activeAcademyRoles->first()?->academyRole;
                    return $role ? $role->display_name : 'No Role';
                })->countBy();
            @endphp
            @foreach($roleDistribution as $role => $count)
                <tr>
                    <td>{{ $role }}</td>
                    <td>{{ $count }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endif
@endsection
