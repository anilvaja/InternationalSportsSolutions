<?php

namespace Database\Seeders;

use App\Models\BatchAttendance;
use App\Models\Batch;
use App\Models\StudentAttendance;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class BatchAttendanceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get all active batches
        $batches = Batch::where('is_active', true)->with('activeStudents')->get();

        if ($batches->isEmpty()) {
            $this->command->info('No active batches found. Please create batches first.');
            return;
        }

        $totalCreated = 0;

        foreach ($batches as $batch) {
            $students = $batch->activeStudents;
            
            if ($students->isEmpty()) {
                continue;
            }

            // Generate batch attendances for the last 2 weeks
            for ($i = 14; $i >= 0; $i--) {
                $date = Carbon::now()->subDays($i);
                
                // Check if this date matches batch days
                $dayOfWeek = strtolower($date->format('l'));
                $batchDays = $batch->days_of_week ?? [];
                
                if (!in_array($dayOfWeek, $batchDays)) {
                    continue; // Skip days not in batch schedule
                }

                // Check if batch attendance already exists
                $existingBatchAttendance = BatchAttendance::where([
                    'batch_id' => $batch->id,
                    'class_date' => $date->format('Y-m-d'),
                ])->first();

                if ($existingBatchAttendance) {
                    continue; // Skip if already exists
                }

                // 95% chance of normal class, 5% chance of cancellation
                $isCancelled = rand(1, 100) <= 5;
                $status = $isCancelled ? 'cancelled' : 'completed';

                // Create batch attendance
                $batchAttendance = BatchAttendance::create([
                    'academy_id' => $batch->academy_id,
                    'batch_id' => $batch->id,
                    'class_date' => $date->format('Y-m-d'),
                    'class_start_time' => $batch->start_time,
                    'class_end_time' => $batch->end_time,
                    'status' => $status,
                    'cancel_reason' => $isCancelled ? 'other' : null,
                    'notes' => $isCancelled ? 'Sample cancellation for testing' : 'Regular class session',
                    'attendance_taken' => !$isCancelled,
                    'attendance_marked_by' => !$isCancelled ? 1 : null,
                    'attendance_marked_at' => !$isCancelled ? $date->copy()->addHours(rand(1, 2)) : null,
                    'created_at' => $date->copy()->subHours(rand(1, 3)),
                    'updated_at' => $date->copy()->subHours(rand(1, 3)),
                ]);

                $totalCreated++;

                // If not cancelled, create student attendances
                if (!$isCancelled) {
                    foreach ($students as $student) {
                        // 85% attendance rate - most students are present
                        $isPresent = rand(1, 100) <= 85;
                        $status = $isPresent ? 'present' : 'absent';
                        
                        // 10% chance of being late if present
                        if ($isPresent && rand(1, 100) <= 10) {
                            $status = 'late';
                        }

                        // 30% chance of excused absence if absent
                        if (!$isPresent && rand(1, 100) <= 30) {
                            $status = 'excused';
                        }

                        // Calculate arrival time for present/late students
                        $arrivalTime = null;
                        if (in_array($status, ['present', 'late'])) {
                            $startTime = Carbon::createFromTimeString($batch->start_time);
                            $minutesVariation = $status === 'late' ? rand(5, 20) : rand(-5, 10);
                            $arrivalTime = $startTime->addMinutes($minutesVariation)->format('H:i:s');
                        }

                        StudentAttendance::create([
                            'academy_id' => $batch->academy_id,
                            'batch_attendance_id' => $batchAttendance->id,
                            'student_id' => $student->id,
                            'status' => $status,
                            'actual_arrival_time' => $arrivalTime,
                            'participation_level' => in_array($status, ['present', 'late']) ? rand(3, 5) : null,
                            'progress_notes' => in_array($status, ['present', 'late']) ? $this->getRandomProgressNote() : null,
                            'notes' => rand(1, 100) <= 20 ? $this->getRandomNote() : null,
                            'created_at' => $date->copy()->addHours(rand(1, 3)),
                            'updated_at' => $date->copy()->addHours(rand(1, 3)),
                        ]);
                    }
                }
            }
        }

        $this->command->info("Created " . $totalCreated . " batch attendance records for " . $batches->count() . " batches.");
    }

    private function getRandomProgressNote(): string
    {
        $notes = [
            'Good improvement in technique',
            'Needs more practice on basics',
            'Excellent participation today',
            'Showed great focus and discipline',
            'Worked well with partner exercises',
            'Demonstrated new techniques well',
            'Needs to work on flexibility',
            'Great attitude and effort',
            'Improved coordination significantly',
            'Ready for next level techniques',
        ];

        return $notes[array_rand($notes)];
    }

    private function getRandomNote(): string
    {
        $notes = [
            'Student arrived early and helped setup',
            'Parent pickup was late',
            'Brought a friend to observe',
            'Mentioned upcoming school exams',
            'Requested extra practice time',
            'Very enthusiastic today',
            'Seemed tired but participated well',
            'Asked good questions about technique',
            'Helped younger students',
            'Expressed interest in competition',
        ];

        return $notes[array_rand($notes)];
    }
}
