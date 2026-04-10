<?php

namespace App\Filament\Academy\Resources\StudentResource\Pages;

use App\Filament\Academy\Resources\StudentResource;
use App\Models\Fee;
use App\Models\StudentAttendance;
use App\Models\BatchAttendance;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;
use Filament\Infolists\Infolist;
use Filament\Infolists\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\Grid;
use Filament\Infolists\Components\Tabs;
use Filament\Support\Enums\FontWeight;
use Illuminate\Support\Facades\DB;

class ViewStudent extends ViewRecord
{
    protected static string $resource = StudentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\EditAction::make(),
        ];
    }

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->schema([
                Tabs::make('Student Details')
                    ->tabs([
                        Tabs\Tab::make('Personal Information')
                            ->icon('heroicon-m-user')
                            ->schema([
                                Section::make('Basic Information')
                                    ->schema([
                                        Grid::make(3)
                                            ->schema([
                                                ImageEntry::make('photo')
                                                    ->circular()
                                                    ->size(150),
                                                
                                                Grid::make(1)
                                                    ->schema([
                                                        TextEntry::make('student_id')
                                                            ->label('Student ID')
                                                            ->badge()
                                                            ->color('primary')
                                                            ->weight(FontWeight::Bold),
                                                        
                                                        TextEntry::make('safe_full_name')
                                                            ->label('Full Name')
                                                            ->formatStateUsing(fn ($record) => $record->getSafeFullName())
                                                            ->weight(FontWeight::Bold)
                                                            ->size('lg'),
                                                        
                                                        TextEntry::make('status')
                                                            ->badge()
                                                            ->color(fn (string $state): string => match ($state) {
                                                                'active' => 'success',
                                                                'inactive' => 'gray',
                                                                'suspended' => 'danger',
                                                                'graduated' => 'warning',
                                                            }),
                                                        
                                                        TextEntry::make('belt_level')
                                                            ->badge()
                                                            ->color(fn (?string $state): string => match ($state) {
                                                                'white' => 'gray',
                                                                'yellow' => 'warning',
                                                                'orange' => 'danger',
                                                                'green' => 'success',
                                                                'blue' => 'info',
                                                                'purple' => 'primary',
                                                                'brown' => 'warning',
                                                                'black' => 'gray',
                                                                default => 'gray',
                                                            })
                                                            ->placeholder('Not assigned'),
                                                    ])
                                                    ->columnSpan(2),
                                            ]),
                                    ]),
                                
                                Section::make('Contact Information')
                                    ->schema([
                                        Grid::make(2)
                                            ->schema([
                                                TextEntry::make('email')
                                                    ->icon('heroicon-m-envelope'),
                                                TextEntry::make('phone')
                                                    ->icon('heroicon-m-phone'),
                                                TextEntry::make('date_of_birth')
                                                    ->date()
                                                    ->icon('heroicon-m-cake'),
                                                TextEntry::make('gender')
                                                    ->badge(),
                                            ]),
                                        
                                        TextEntry::make('address')
                                            ->columnSpanFull(),
                                        
                                        Grid::make(4)
                                            ->schema([
                                                TextEntry::make('city'),
                                                TextEntry::make('state'),
                                                TextEntry::make('postal_code'),
                                                TextEntry::make('country'),
                                            ]),
                                    ]),
                                
                                Section::make('Parent/Guardian Information')
                                    ->schema([
                                        Grid::make(2)
                                            ->schema([
                                                TextEntry::make('parent_name')
                                                    ->icon('heroicon-m-user'),
                                                TextEntry::make('parent_relationship')
                                                    ->badge(),
                                                TextEntry::make('parent_phone')
                                                    ->icon('heroicon-m-phone'),
                                                TextEntry::make('parent_email')
                                                    ->icon('heroicon-m-envelope'),
                                            ]),
                                    ]),
                                
                                Section::make('Emergency Contact')
                                    ->schema([
                                        Grid::make(3)
                                            ->schema([
                                                TextEntry::make('emergency_contact_name')
                                                    ->icon('heroicon-m-user'),
                                                TextEntry::make('emergency_contact_phone')
                                                    ->icon('heroicon-m-phone'),
                                                TextEntry::make('emergency_contact_relationship')
                                                    ->badge(),
                                            ]),
                                    ]),
                            ]),
                        
                        Tabs\Tab::make('Fees & Payments')
                            ->icon('heroicon-m-banknotes')
                            ->schema([
                                Section::make('Fees Summary')
                                    ->schema([
                                        Grid::make(4)
                                            ->schema([
                                                TextEntry::make('total_fees')
                                                    ->label('Total Fees')
                                                    ->state(function ($record) {
                                                        return '₹' . number_format(
                                                            Fee::where('student_id', $record->id)->sum('fees_amount'), 
                                                            2
                                                        );
                                                    })
                                                    ->weight(FontWeight::Bold)
                                                    ->color('primary'),
                                                
                                                TextEntry::make('paid_fees')
                                                    ->label('Paid')
                                                    ->state(function ($record) {
                                                        return '₹' . number_format(
                                                            Fee::where('student_id', $record->id)
                                                                ->where('status', 'paid')
                                                                ->sum('fees_amount'), 
                                                            2
                                                        );
                                                    })
                                                    ->weight(FontWeight::Bold)
                                                    ->color('success'),
                                                
                                                TextEntry::make('pending_fees')
                                                    ->label('Pending')
                                                    ->state(function ($record) {
                                                        return '₹' . number_format(
                                                            Fee::where('student_id', $record->id)
                                                                ->where('status', 'pending')
                                                                ->sum('fees_amount'), 
                                                            2
                                                        );
                                                    })
                                                    ->weight(FontWeight::Bold)
                                                    ->color('warning'),
                                                
                                                TextEntry::make('overdue_fees')
                                                    ->label('Overdue')
                                                    ->state(function ($record) {
                                                        return '₹' . number_format(
                                                            Fee::where('student_id', $record->id)
                                                                ->where('status', 'overdue')
                                                                ->sum('fees_amount'), 
                                                            2
                                                        );
                                                    })
                                                    ->weight(FontWeight::Bold)
                                                    ->color('danger'),
                                            ]),
                                    ]),
                                
                                Section::make('Recent Fees')
                                    ->schema([
                                        TextEntry::make('recent_fees_list')
                                            ->label('Latest Fee Records')
                                            ->state(function ($record) {
                                                $fees = Fee::where('student_id', $record->id)
                                                    ->orderBy('due_date', 'desc')
                                                    ->limit(5)
                                                    ->get();
                                                
                                                if ($fees->isEmpty()) {
                                                    return 'No fees records found';
                                                }
                                                
                                                $result = '';
                                                foreach ($fees as $fee) {
                                                    $dueDate = $fee->due_date ? $fee->due_date->format('M d, Y') : 'No due date';
                                                    $result .= "• {$fee->receipt_number} - ₹" . number_format($fee->fees_amount, 2) . " ({$fee->status}) - Due: {$dueDate}\n";
                                                }
                                                
                                                return $result;
                                            })
                                            ->columnSpanFull(),
                                        
                                        TextEntry::make('fees_actions')
                                            ->label('Quick Actions')
                                            ->state(function ($record) {
                                                $pendingCount = Fee::where('student_id', $record->id)
                                                    ->whereIn('status', ['pending', 'overdue'])
                                                    ->count();
                                                
                                                if ($pendingCount > 0) {
                                                    return "⚠️ {$pendingCount} pending/overdue fees need attention";
                                                }
                                                
                                                return "✅ All fees are up to date";
                                            })
                                            ->color(function ($record) {
                                                $pendingCount = Fee::where('student_id', $record->id)
                                                    ->whereIn('status', ['pending', 'overdue'])
                                                    ->count();
                                                
                                                return $pendingCount > 0 ? 'warning' : 'success';
                                            }),
                                    ]),
                            ]),
                        
                        Tabs\Tab::make('Attendance')
                            ->icon('heroicon-m-calendar-days')
                            ->schema([
                                Section::make('Attendance Summary')
                                    ->schema([
                                        Grid::make(4)
                                            ->schema([
                                                TextEntry::make('total_classes')
                                                    ->label('Total Classes')
                                                    ->state(function ($record) {
                                                        return StudentAttendance::join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                                                            ->where('student_attendances.student_id', $record->id)
                                                            ->where('batch_attendances.academy_id', $record->academy_id)
                                                            ->count();
                                                    })
                                                    ->weight(FontWeight::Bold)
                                                    ->color('primary'),
                                                
                                                TextEntry::make('present_classes')
                                                    ->label('Present')
                                                    ->state(function ($record) {
                                                        return StudentAttendance::join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                                                            ->where('student_attendances.student_id', $record->id)
                                                            ->where('student_attendances.status', 'present')
                                                            ->where('batch_attendances.academy_id', $record->academy_id)
                                                            ->count();
                                                    })
                                                    ->weight(FontWeight::Bold)
                                                    ->color('success'),
                                                
                                                TextEntry::make('absent_classes')
                                                    ->label('Absent')
                                                    ->state(function ($record) {
                                                        return StudentAttendance::join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                                                            ->where('student_attendances.student_id', $record->id)
                                                            ->where('student_attendances.status', 'absent')
                                                            ->where('batch_attendances.academy_id', $record->academy_id)
                                                            ->count();
                                                    })
                                                    ->weight(FontWeight::Bold)
                                                    ->color('danger'),
                                                
                                                TextEntry::make('attendance_percentage')
                                                    ->label('Attendance %')
                                                    ->state(function ($record) {
                                                        $total = StudentAttendance::join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                                                            ->where('student_attendances.student_id', $record->id)
                                                            ->where('batch_attendances.academy_id', $record->academy_id)
                                                            ->count();
                                                        
                                                        if ($total == 0) return '0%';
                                                        
                                                        $present = StudentAttendance::join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                                                            ->where('student_attendances.student_id', $record->id)
                                                            ->where('student_attendances.status', 'present')
                                                            ->where('batch_attendances.academy_id', $record->academy_id)
                                                            ->count();
                                                        
                                                        $percentage = round(($present / $total) * 100, 1);
                                                        return $percentage . '%';
                                                    })
                                                    ->weight(FontWeight::Bold)
                                                    ->color('info'),
                                            ]),
                                    ]),
                                
                                Section::make('Recent Attendance')
                                    ->schema([
                                        TextEntry::make('recent_attendance_list')
                                            ->label('Latest Attendance Records')
                                            ->state(function ($record) {
                                                $attendances = StudentAttendance::join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                                                    ->join('batches', 'batch_attendances.batch_id', '=', 'batches.id')
                                                    ->where('student_attendances.student_id', $record->id)
                                                    ->where('batch_attendances.academy_id', $record->academy_id)
                                                    ->select([
                                                        'student_attendances.status',
                                                        'batch_attendances.class_date',
                                                        'batches.name as batch_name',
                                                        'batch_attendances.class_start_time',
                                                        'batch_attendances.class_end_time'
                                                    ])
                                                    ->orderBy('batch_attendances.class_date', 'desc')
                                                    ->limit(10)
                                                    ->get();
                                                
                                                if ($attendances->isEmpty()) {
                                                    return 'No attendance records found';
                                                }
                                                
                                                $result = '';
                                                foreach ($attendances as $attendance) {
                                                    $icon = $attendance->status === 'present' ? '✓' : '✗';
                                                    $result .= "{$icon} {$attendance->batch_name} - " . 
                                                        \Carbon\Carbon::parse($attendance->class_date)->format('M d, Y') . 
                                                        " ({$attendance->status})\n";
                                                }
                                                
                                                return $result;
                                            })
                                            ->columnSpanFull(),
                                        
                                        TextEntry::make('attendance_status')
                                            ->label('Attendance Status')
                                            ->state(function ($record) {
                                                // Check for consecutive absences
                                                $recentAttendances = StudentAttendance::join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                                                    ->where('student_attendances.student_id', $record->id)
                                                    ->where('batch_attendances.academy_id', $record->academy_id)
                                                    ->orderBy('batch_attendances.class_date', 'desc')
                                                    ->limit(3)
                                                    ->pluck('student_attendances.status')
                                                    ->toArray();
                                                
                                                if (count($recentAttendances) >= 3 && 
                                                    $recentAttendances[0] === 'absent' && 
                                                    $recentAttendances[1] === 'absent' && 
                                                    $recentAttendances[2] === 'absent') {
                                                    return '⚠️ 3+ consecutive absences - Needs attention';
                                                }
                                                
                                                if (count($recentAttendances) > 0 && $recentAttendances[0] === 'absent') {
                                                    return '⚡ Last class absent';
                                                }
                                                
                                                return '✅ Good attendance pattern';
                                            })
                                            ->color(function ($record) {
                                                $recentAttendances = StudentAttendance::join('batch_attendances', 'student_attendances.batch_attendance_id', '=', 'batch_attendances.id')
                                                    ->where('student_attendances.student_id', $record->id)
                                                    ->where('batch_attendances.academy_id', $record->academy_id)
                                                    ->orderBy('batch_attendances.class_date', 'desc')
                                                    ->limit(3)
                                                    ->pluck('student_attendances.status')
                                                    ->toArray();
                                                
                                                if (count($recentAttendances) >= 3 && 
                                                    $recentAttendances[0] === 'absent' && 
                                                    $recentAttendances[1] === 'absent' && 
                                                    $recentAttendances[2] === 'absent') {
                                                    return 'danger';
                                                }
                                                
                                                if (count($recentAttendances) > 0 && $recentAttendances[0] === 'absent') {
                                                    return 'warning';
                                                }
                                                
                                                return 'success';
                                            }),
                                    ]),
                            ]),
                        
                        Tabs\Tab::make('Academy Details')
                            ->icon('heroicon-m-building-office-2')
                            ->schema([
                                Section::make('Academy Information')
                                    ->schema([
                                        Grid::make(2)
                                            ->schema([
                                                TextEntry::make('branch.name')
                                                    ->label('Branch')
                                                    ->badge()
                                                    ->color('info'),
                                                
                                                TextEntry::make('enrollment_date')
                                                    ->date()
                                                    ->icon('heroicon-m-calendar'),
                                                
                                                TextEntry::make('activeBatches')
                                                    ->label('Current Batches')
                                                    ->formatStateUsing(function ($record) {
                                                        $batches = $record->batches()
                                                            ->wherePivot('is_active', true)
                                                            ->get();
                                                        
                                                        if ($batches->isEmpty()) {
                                                            return 'Not enrolled in any batch';
                                                        }
                                                        
                                                        return $batches->pluck('name')->implode(', ');
                                                    })
                                                    ->badge()
                                                    ->color('primary'),
                                            ]),
                                        
                                        TextEntry::make('notes')
                                            ->columnSpanFull()
                                            ->placeholder('No notes available'),
                                    ]),
                                
                                Section::make('Medical Information')
                                    ->schema([
                                        Grid::make(2)
                                            ->schema([
                                                TextEntry::make('blood_group')
                                                    ->badge()
                                                    ->color('danger'),
                                                
                                                TextEntry::make('medical_conditions')
                                                    ->placeholder('None'),
                                                
                                                TextEntry::make('allergies')
                                                    ->placeholder('None'),
                                                
                                                TextEntry::make('medications')
                                                    ->placeholder('None'),
                                            ]),
                                        
                                        TextEntry::make('dietary_restrictions')
                                            ->columnSpanFull()
                                            ->placeholder('None'),
                                    ])
                                    ->collapsible(),
                            ]),
                    ])
                    ->columnSpanFull(),
            ]);
    }
}
