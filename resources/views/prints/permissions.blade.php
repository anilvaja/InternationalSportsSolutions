@extends('prints.layout')

@section('content')
<div class="section">
    <div class="section-title">System Permissions</div>
    
    @foreach($permissions as $category => $categoryPermissions)
        <div class="section" style="margin: 20px 0;">
            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 16px;">
                {{ ucwords(str_replace('_', ' ', $category)) }}
            </h3>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%;">Permission Name</th>
                        <th style="width: 25%;">System Name</th>
                        <th style="width: 45%;">Description</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($categoryPermissions as $permission)
                        <tr>
                            <td>{{ $permission->display_name }}</td>
                            <td style="font-family: monospace; font-size: 12px; color: #6b7280;">
                                {{ $permission->name }}
                            </td>
                            <td>{{ $permission->description ?? 'No description available' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endforeach
</div>

<div class="section">
    <div class="section-title">Summary</div>
    <table>
        <thead>
            <tr>
                <th>Category</th>
                <th>Permission Count</th>
            </tr>
        </thead>
        <tbody>
            @foreach($permissions as $category => $categoryPermissions)
                <tr>
                    <td>{{ ucwords(str_replace('_', ' ', $category)) }}</td>
                    <td>{{ count($categoryPermissions) }}</td>
                </tr>
            @endforeach
            <tr style="font-weight: bold; background-color: #f3f4f6;">
                <td>Total Permissions</td>
                <td>{{ $permissions->flatten()->count() }}</td>
            </tr>
        </tbody>
    </table>
</div>
@endsection
