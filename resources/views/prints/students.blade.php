@extends('prints.layout')

@section('content')
<div class="section">
    <div class="section-title">Academy Students</div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 20%;">Student Name</th>
                <th style="width: 15%;">ID Number</th>
                <th style="width: 20%;">Branch</th>
                <th style="width: 15%;">Phone</th>
                <th style="width: 15%;">Join Date</th>
                <th style="width: 15%;">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($students as $student)
                <tr>
                    <td>{{ $student->getSafeFullName() }}</td>
                    <td style="font-family: monospace;">{{ $student->student_id ?? 'N/A' }}</td>
                    <td>{{ $student->branch->name ?? 'N/A' }}</td>
                    <td>{{ $student->phone ?? 'N/A' }}</td>
                    <td>{{ $student->join_date ? $student->join_date->format('Y-m-d') : 'N/A' }}</td>
                    <td>
                        <span class="badge badge-{{ $student->is_active ? 'success' : 'danger' }}">
                            {{ $student->is_active ? 'Active' : 'Inactive' }}
                        </span>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

<div class="section">
    <div class="section-title">Student Statistics</div>
    <table>
        <thead>
            <tr>
                <th>Metric</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Total Students</td>
                <td>{{ $students->count() }}</td>
            </tr>
            <tr>
                <td>Active Students</td>
                <td>{{ $students->where('is_active', true)->count() }}</td>
            </tr>
            <tr>
                <td>Inactive Students</td>
                <td>{{ $students->where('is_active', false)->count() }}</td>
            </tr>
        </tbody>
    </table>
</div>

@if($students->isNotEmpty())
<div class="section">
    <div class="section-title">Branch-wise Distribution</div>
    <table>
        <thead>
            <tr>
                <th>Branch</th>
                <th>Student Count</th>
            </tr>
        </thead>
        <tbody>
            @php
                $branchDistribution = $students->groupBy('branch.name')->map->count();
            @endphp
            @foreach($branchDistribution as $branch => $count)
                <tr>
                    <td>{{ $branch ?: 'No Branch' }}</td>
                    <td>{{ $count }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endif
@endsection
