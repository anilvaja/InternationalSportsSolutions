@extends('prints.layout')

@section('content')
<div class="section">
    <div class="section-title">Academy Batches</div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 20%;">Batch Name</th>
                <th style="width: 15%;">Code</th>
                <th style="width: 15%;">Branch</th>
                <th style="width: 15%;">Coach</th>
                <th style="width: 15%;">Schedule</th>
                <th style="width: 10%;">Students</th>
                <th style="width: 10%;">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($batches as $batch)
                <tr>
                    <td>{{ $batch->name }}</td>
                    <td>{{ $batch->batch_code }}</td>
                    <td>{{ $batch->branch->name ?? 'N/A' }}</td>
                    <td>{{ $batch->coach->name ?? 'No Coach' }}</td>
                    <td>
                        @if($batch->start_time && $batch->end_time)
                            {{ $batch->start_time }} - {{ $batch->end_time }}
                            @if($batch->days_of_week)
                                <br><small>{{ is_array($batch->days_of_week) ? implode(', ', $batch->days_of_week) : $batch->days_of_week }}</small>
                            @endif
                        @else
                            N/A
                        @endif
                    </td>
                    <td>{{ $batch->students->count() }}/{{ $batch->max_students ?? 'N/A' }}</td>
                    <td>
                        <span class="badge badge-{{ $batch->is_active ? 'success' : 'danger' }}">
                            {{ $batch->getStatusText() }}
                        </span>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>

<div class="section">
    <div class="section-title">Batch Details</div>
    @foreach($batches as $batch)
        <div style="margin-bottom: 20px; page-break-inside: avoid;">
            <h4>{{ $batch->name }} ({{ $batch->batch_code }})</h4>
            <table style="margin-top: 10px;">
                <tr>
                    <td style="width: 25%; font-weight: bold;">Branch:</td>
                    <td style="width: 25%;">{{ $batch->branch->name ?? 'N/A' }}</td>
                    <td style="width: 25%; font-weight: bold;">Coach:</td>
                    <td style="width: 25%;">{{ $batch->coach->name ?? 'No Coach' }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Schedule:</td>
                    <td>{{ $batch->start_time ?? 'N/A' }} - {{ $batch->end_time ?? 'N/A' }}</td>
                    <td style="font-weight: bold;">Days:</td>
                    <td>{{ is_array($batch->days_of_week) ? implode(', ', $batch->days_of_week) : ($batch->days_of_week ?? 'N/A') }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Duration:</td>
                    <td>{{ $batch->start_date ? $batch->start_date->format('M d, Y') : 'N/A' }} - {{ $batch->end_date ? $batch->end_date->format('M d, Y') : 'Ongoing' }}</td>
                    <td style="font-weight: bold;">Location:</td>
                    <td>{{ $batch->room_location ?? 'N/A' }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Capacity:</td>
                    <td>{{ $batch->students->count() }}/{{ $batch->max_students ?? 'N/A' }} students</td>
                    <td style="font-weight: bold;">Level:</td>
                    <td>{{ ucfirst($batch->level ?? 'N/A') }}</td>
                </tr>
            </table>
            
            @if($batch->students->isNotEmpty())
                <h5 style="margin-top: 15px;">Active Students ({{ $batch->students->count() }}):</h5>
                <div style="font-size: 12px;">
                    @foreach($batch->students as $student)
                        <span style="display: inline-block; margin-right: 15px; margin-bottom: 5px;">
                            {{ $student->getSafeFullName() }} ({{ $student->student_id }})
                        </span>
                    @endforeach
                </div>
            @endif
            
            @if($batch->description)
                <p style="margin-top: 10px; font-size: 12px;"><strong>Description:</strong> {{ $batch->description }}</p>
            @endif
        </div>
    @endforeach
</div>

<div class="section">
    <div class="section-title">Batch Statistics</div>
    <table>
        <thead>
            <tr>
                <th>Metric</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Total Batches</td>
                <td>{{ $batches->count() }}</td>
            </tr>
            <tr>
                <td>Active Batches</td>
                <td>{{ $batches->where('is_active', true)->count() }}</td>
            </tr>
            <tr>
                <td>Total Students Enrolled</td>
                <td>{{ $batches->sum(function($batch) { return $batch->students->count(); }) }}</td>
            </tr>
            <tr>
                <td>Average Students per Batch</td>
                <td>{{ $batches->count() > 0 ? round($batches->sum(function($batch) { return $batch->students->count(); }) / $batches->count(), 1) : 0 }}</td>
            </tr>
            <tr>
                <td>Batches with Coaches</td>
                <td>{{ $batches->whereNotNull('coach_id')->count() }}</td>
            </tr>
            <tr>
                <td>Total Capacity</td>
                <td>{{ $batches->sum('max_students') }}</td>
            </tr>
            <tr>
                <td>Capacity Utilization</td>
                <td>{{ $batches->sum('max_students') > 0 ? round(($batches->sum(function($batch) { return $batch->students->count(); }) / $batches->sum('max_students')) * 100, 1) : 0 }}%</td>
            </tr>
        </tbody>
    </table>
</div>

@if($batches->isNotEmpty())
<div class="section">
    <div class="section-title">Branch-wise Distribution</div>
    <table>
        <thead>
            <tr>
                <th>Branch</th>
                <th>Batch Count</th>
                <th>Total Students</th>
                <th>Average Capacity %</th>
            </tr>
        </thead>
        <tbody>
            @php
                $branchDistribution = $batches->groupBy('branch.name');
            @endphp
            @foreach($branchDistribution as $branch => $branchBatches)
                @php
                    $totalStudents = $branchBatches->sum(function($batch) { return $batch->students->count(); });
                    $totalCapacity = $branchBatches->sum('max_students');
                    $avgCapacity = $totalCapacity > 0 ? round(($totalStudents / $totalCapacity) * 100, 1) : 0;
                @endphp
                <tr>
                    <td>{{ $branch ?: 'No Branch' }}</td>
                    <td>{{ $branchBatches->count() }}</td>
                    <td>{{ $totalStudents }}</td>
                    <td>{{ $avgCapacity }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endif
@endsection
