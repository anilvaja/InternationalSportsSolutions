<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Batch;
use App\Models\Student;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class AttendanceSeeder extends Seeder
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

        $attendanceCount = 0;

        foreach ($batches as $batch) {
            $students = $batch->activeStudents;
            
            if ($students->isEmpty()) {
                continue;
            }

            // Generate attendance for the last 2 weeks
            for ($i = 14; $i >= 0; $i--) {
                $date = Carbon::now()->subDays($i);
                
                // Check if this date matches batch days
                $dayOfWeek = strtolower($date->format('l'));
                $batchDays = $batch->days_of_week ?? [];
                
                if (!in_array($dayOfWeek, $batchDays)) {
                    continue; // Skip days not in batch schedule
                }

                // Create attendance for each student
                foreach ($students as $student) {
                    // Check if attendance already exists for this student, batch, and date
                    $existingAttendance = Attendance::where([
                        'student_id' => $student->id,
                        'batch_id' => $batch->id,
                        'class_date' => $date->format('Y-m-d'),
                    ])->first();

                    if ($existingAttendance) {
                        continue; // Skip if already exists
                    }

                    // 85% attendance rate - most students are present
                    $isPresent = rand(1, 100) <= 85;
                    $status = $isPresent ? 'present' : 'absent';
                    
                    // 10% chance of being late if present
                    if ($isPresent && rand(1, 100) <= 10) {
                        $status = 'late';
                    }

                    // 5% chance of excused absence if absent
                    if (!$isPresent && rand(1, 100) <= 30) {
                        $status = 'excused';
                    }

                    // Clone the start time for arrival time calculation
                    $startTime = Carbon::createFromTimeString($batch->start_time);
                    $actualArrivalTime = $isPresent ? $startTime->addMinutes(rand(-5, 15))->format('H:i:s') : null;

                    Attendance::create([
                        'student_id' => $student->id,
                        'batch_id' => $batch->id,
                        'class_date' => $date->format('Y-m-d'),
                        'class_start_time' => $batch->start_time,
                        'class_end_time' => $batch->end_time,
                        'status' => $status,
                        'actual_arrival_time' => $actualArrivalTime,
                        'participation_level' => $isPresent ? rand(3, 5) : null,
                        'progress_notes' => $isPresent ? $this->getRandomProgressNote() : null,
                        'notes' => rand(1, 100) <= 20 ? $this->getRandomNote() : null,
                        'marked_by' => 1, // Assume first user is marking attendance
                        'created_at' => $date->copy()->addHours(rand(1, 3)),
                        'updated_at' => $date->copy()->addHours(rand(1, 3)),
                    ]);

                    $attendanceCount++;
                }
            }
        }

        $this->command->info("Created " . $attendanceCount . " attendance records for " . $batches->count() . " batches.");
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
