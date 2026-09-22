@extends('prints.layout')

@section('content')
<div class="section">
    <div class="section-title">Academy Branches</div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 25%;">Branch Name</th>
                <th style="width: 30%;">Address</th>
                <th style="width: 15%;">Contact</th>
                <th style="width: 15%;">Students</th>
                <th style="width: 15%;">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($branches as $branch)
                <tr>
                    <td>{{ $branch->name }}</td>
                    <td>{{ $branch->address ?? 'N/A' }}</td>
                    <td>{{ $branch->phone ?? 'N/A' }}</td>
                    <td>{{ $branch->students_count }}</td>
                    <td>
                        <span class="badge badge-{{ $branch->isActive() ? 'success' : 'danger' }}">
                            {{ $branch->isActive() ? 'Active' : 'Inactive' }}
                        </span>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

<div class="section">
    <div class="section-title">Branch Statistics</div>
    <table>
        <thead>
            <tr>
                <th>Metric</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Total Branches</td>
                <td>{{ $branches->count() }}</td>
            </tr>
            <tr>
                <td>Active Branches</td>
                <td>{{ $branches->filter(fn ($b) => $b->isActive())->count() }}</td>
            </tr>
            <tr>
                <td>Total Students</td>
                <td>{{ $branches->sum('students_count') }}</td>
            </tr>
            <tr>
                <td>Average Students per Branch</td>
                <td>{{ $branches->count() > 0 ? round($branches->sum('students_count') / $branches->count(), 1) : 0 }}</td>
            </tr>
        </tbody>
    </table>
</div>
@endsection
