@extends('prints.layout')

@section('content')
<div class="section">
    <div class="section-title">Event Information</div>
    <table style="margin-bottom: 30px;">
        <tr>
            <th style="width: 20%;">Event Title</th>
            <td>{{ $event->title }}</td>
        </tr>
        <tr>
            <th>Event Date</th>
            <td>{{ $event->event_date->format('d M Y, H:i') }}</td>
        </tr>
        <tr>
            <th>Event Type</th>
            <td>{{ ucfirst($event->type) }}</td>
        </tr>
        <tr>
            <th>Status</th>
            <td>
                <span class="badge 
                    @if($event->status === 'scheduled') badge-primary
                    @elseif($event->status === 'ongoing') badge-warning
                    @elseif($event->status === 'completed') badge-success
                    @else badge-danger
                    @endif">
                    {{ ucfirst($event->status) }}
                </span>
            </td>
        </tr>
        @if($event->location)
        <tr>
            <th>Location</th>
            <td>{{ $event->location }}</td>
        </tr>
        @endif
        @if($event->venue)
        <tr>
            <th>Venue</th>
            <td>{{ $event->venue }}</td>
        </tr>
        @endif
        @if($event->fee > 0)
        <tr>
            <th>Event Fee</th>
            <td>${{ number_format($event->fee, 2) }}</td>
        </tr>
        @endif
        @if($event->description)
        <tr>
            <th>Description</th>
            <td>{{ $event->description }}</td>
        </tr>
        @endif
    </table>
</div>

<div class="section">
    <div class="section-title">Participation Statistics</div>
    <table style="margin-bottom: 30px;">
        <thead>
            <tr>
                <th>Status</th>
                <th>Count</th>
                <th>Percentage</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Total Invited</td>
                <td><strong>{{ $stats['total'] }}</strong></td>
                <td>100%</td>
            </tr>
            <tr>
                <td>
                    <span class="badge badge-success">Interested</span>
                </td>
                <td>{{ $stats['interested'] }}</td>
                <td>{{ $stats['total'] > 0 ? round(($stats['interested'] / $stats['total']) * 100, 1) : 0 }}%</td>
            </tr>
            <tr>
                <td>
                    <span class="badge badge-danger">Not Interested</span>
                </td>
                <td>{{ $stats['not_interested'] }}</td>
                <td>{{ $stats['total'] > 0 ? round(($stats['not_interested'] / $stats['total']) * 100, 1) : 0 }}%</td>
            </tr>
            <tr>
                <td>
                    <span class="badge badge-primary">Attended</span>
                </td>
                <td>{{ $stats['attended'] }}</td>
                <td>{{ $stats['total'] > 0 ? round(($stats['attended'] / $stats['total']) * 100, 1) : 0 }}%</td>
            </tr>
            <tr>
                <td>
                    <span class="badge">No Show</span>
                </td>
                <td>{{ $stats['no_show'] }}</td>
                <td>{{ $stats['total'] > 0 ? round(($stats['no_show'] / $stats['total']) * 100, 1) : 0 }}%</td>
            </tr>
            <tr>
                <td>
                    <span class="badge badge-warning">Pending Response</span>
                </td>
                <td>{{ $stats['pending'] }}</td>
                <td>{{ $stats['total'] > 0 ? round(($stats['pending'] / $stats['total']) * 100, 1) : 0 }}%</td>
            </tr>
        </tbody>
    </table>
</div>

@if($participants->count() > 0)
<div class="section">
    <div class="section-title">Participants List</div>
    <table>
        <thead>
            <tr>
                <th style="width: 10%;">#</th>
                <th style="width: 12%;">Student ID</th>
                <th style="width: 20%;">Name</th>
                <th style="width: 15%;">Email</th>
                <th style="width: 12%;">Phone</th>
                <th style="width: 10%;">Status</th>
                @if($event->fee > 0)
                <th style="width: 10%;">Fee Status</th>
                <th style="width: 8%;">Amount</th>
                @endif
                <th style="width: 13%;">Response Date</th>
            </tr>
        </thead>
        <tbody>
            @foreach($participants as $index => $participant)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $participant->student->student_id }}</td>
                <td>{{ $participant->student->first_name }} {{ $participant->student->last_name }}</td>
                <td>{{ $participant->student->email ?? '-' }}</td>
                <td>{{ $participant->student->phone ?? '-' }}</td>
                <td>
                    <span class="badge 
                        @if($participant->status === 'interested') badge-success
                        @elseif($participant->status === 'not_interested') badge-danger
                        @elseif($participant->status === 'attended') badge-primary
                        @elseif($participant->status === 'no_show') 
                        @else badge-warning
                        @endif">
                        {{ ucfirst(str_replace('_', ' ', $participant->status)) }}
                    </span>
                </td>
                @if($event->fee > 0)
                <td>
                    @php
                        $payment = $paymentInfo->get($participant->student->id);
                        $paymentStatus = $payment ? $payment->payment_status : 'pending';
                    @endphp
                    <span class="badge 
                        @if($paymentStatus === 'paid') badge-success
                        @elseif($paymentStatus === 'partial') badge-primary
                        @elseif($paymentStatus === 'overdue') badge-danger
                        @else badge-warning
                        @endif">
                        {{ ucfirst($paymentStatus) }}
                    </span>
                </td>
                <td>
                    @if($payment)
                        ${{ number_format($payment->final_amount, 2) }}
                    @else
                        ${{ number_format($event->fee, 2) }}
                    @endif
                </td>
                @endif
                <td>
                    {{ $participant->responded_at ? $participant->responded_at->format('d M Y') : '-' }}
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>
</div>

@if($event->fee > 0)
<div class="section">
    <div class="section-title">Payment Summary</div>
    <table>
        <thead>
            <tr>
                <th>Payment Status</th>
                <th>Count</th>
                <th>Total Amount</th>
            </tr>
        </thead>
        <tbody>
            @php
                $paymentStats = [
                    'paid' => ['count' => 0, 'amount' => 0],
                    'pending' => ['count' => 0, 'amount' => 0],
                    'partial' => ['count' => 0, 'amount' => 0],
                    'overdue' => ['count' => 0, 'amount' => 0],
                ];
                
                foreach($participants as $participant) {
                    $payment = $paymentInfo->get($participant->student->id);
                    $status = $payment ? $payment->payment_status : 'pending';
                    $amount = $payment ? $payment->final_amount : $event->fee;
                    
                    $paymentStats[$status]['count']++;
                    $paymentStats[$status]['amount'] += $amount;
                }
            @endphp
            @foreach($paymentStats as $status => $stats)
            @if($stats['count'] > 0)
            <tr>
                <td>
                    <span class="badge 
                        @if($status === 'paid') badge-success
                        @elseif($status === 'partial') badge-primary
                        @elseif($status === 'overdue') badge-danger
                        @else badge-warning
                        @endif">
                        {{ ucfirst($status) }}
                    </span>
                </td>
                <td>{{ $stats['count'] }}</td>
                <td>${{ number_format($stats['amount'], 2) }}</td>
            </tr>
            @endif
            @endforeach
            <tr style="font-weight: bold; border-top: 2px solid #374151;">
                <td>Total</td>
                <td>{{ $participants->count() }}</td>
                <td>${{ number_format(array_sum(array_column($paymentStats, 'amount')), 2) }}</td>
            </tr>
        </tbody>
    </table>
</div>
@endif

@else
<div class="section">
    <p style="text-align: center; font-style: italic; color: #6b7280; padding: 40px;">
        No participants have been added to this event yet.
    </p>
</div>
@endif

@if($participants->where('response_notes', '!=', null)->count() > 0)
<div class="section page-break">
    <div class="section-title">Participant Notes</div>
    @foreach($participants->where('response_notes', '!=', null) as $participant)
    <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px;">
        <strong>{{ $participant->student->first_name }} {{ $participant->student->last_name }}</strong> 
        ({{ $participant->student->student_id }})
        <div style="margin-top: 5px; color: #6b7280; font-size: 13px;">
            {{ $participant->response_notes }}
        </div>
    </div>
    @endforeach
</div>
@endif
@endsection
