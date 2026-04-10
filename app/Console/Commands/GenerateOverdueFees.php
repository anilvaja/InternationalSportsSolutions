<?php

namespace App\Console\Commands;

use App\Models\Fee;
use App\Models\Student;
use App\Models\Academy;
use App\Notifications\OverdueFeeNotification;
use Illuminate\Console\Command;
use Carbon\Carbon;

class GenerateOverdueFees extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'fees:generate-overdue {--academy-id= : Generate for specific academy only} {--send-notifications : Send email and SMS notifications} {--notification-days=7 : Days overdue before sending notifications}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate overdue fee entries for students based on batch start dates and last payment dates, with optional notifications';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting overdue fee generation...');
        
        $academyId = $this->option('academy-id');
        $sendNotifications = $this->option('send-notifications');
        $notificationDays = (int) $this->option('notification-days');
        
        $academies = $academyId ? Academy::where('id', $academyId)->get() : Academy::all();
        
        $totalGenerated = 0;
        $totalNotificationsSent = 0;
        
        foreach ($academies as $academy) {
            $this->info("Processing Academy: {$academy->name}");
            $result = $this->generateOverdueFeesForAcademy($academy->id, $sendNotifications, $notificationDays);
            $totalGenerated += $result['generated'];
            $totalNotificationsSent += $result['notifications_sent'];
            $this->info("Generated {$result['generated']} overdue entries for {$academy->name}");
            if ($sendNotifications && $result['notifications_sent'] > 0) {
                $this->info("Sent {$result['notifications_sent']} notifications");
            }
        }
        
        $this->info("Total overdue fee entries generated: {$totalGenerated}");
        if ($sendNotifications) {
            $this->info("Total notifications sent: {$totalNotificationsSent}");
        }
        
        return Command::SUCCESS;
    }

    private function generateOverdueFeesForAcademy($academyId, $sendNotifications = false, $notificationDays = 7): array
    {
        $generatedCount = 0;
        $skippedCount = 0;
        $notificationsSent = 0;
        $gracePeriod = 7; // days after batch start
        
        // Get all active students in the academy
        $students = Student::where('academy_id', $academyId)
            ->where('status', 'active')
            ->whereHas('activeBatches')
            ->with(['activeBatches', 'fees' => function($query) {
                $query->orderBy('fees_to_date', 'desc');
            }])
            ->get();

        foreach ($students as $student) {
            $activeBatch = $student->activeBatches->first();
            if (!$activeBatch) continue;

            $lastPaidFee = $student->fees()
                ->where('status', 'paid')
                ->orderBy('fees_to_date', 'desc')
                ->first();

            $shouldGenerateOverdue = false;
            $overdueFromDate = null;
            $overdueToDate = null;
            $dueDate = null;

            if (!$lastPaidFee) {
                // New student - check if batch started more than grace period ago
                $batchStartWithGrace = $activeBatch->start_date->copy()->addDays($gracePeriod);
                if ($batchStartWithGrace->isPast()) {
                    // Check if overdue/cancelled entry already exists for this period
                    $existingEntry = $student->fees()
                        ->whereIn('status', ['overdue', 'cancelled'])
                        ->where('fees_from_date', '>=', $activeBatch->start_date)
                        ->where('fees_from_date', '<=', $batchStartWithGrace)
                        ->first();
                    
                    if (!$existingEntry) {
                        $shouldGenerateOverdue = true;
                        $overdueFromDate = $activeBatch->start_date;
                        $overdueToDate = $overdueFromDate->copy()->addMonth()->subDay();
                        $dueDate = $batchStartWithGrace;
                    } else {
                        $this->line("  Skipped {$student->first_name} {$student->last_name} - Entry already exists (Status: {$existingEntry->status})");
                        $skippedCount++;
                    }
                }
            } else {
                // Existing student - check if next installment is overdue
                $nextDueDate = $lastPaidFee->fees_to_date->copy()->addDay();
                if ($nextDueDate->isPast()) {
                    // Check if overdue/cancelled entry already exists for this exact period
                    $existingEntry = $student->fees()
                        ->whereIn('status', ['overdue', 'cancelled'])
                        ->where('fees_from_date', $nextDueDate)
                        ->first();
                    
                    if (!$existingEntry) {
                        $shouldGenerateOverdue = true;
                        $overdueFromDate = $nextDueDate;
                        $overdueToDate = $overdueFromDate->copy()->addMonth()->subDay();
                        $dueDate = $nextDueDate;
                    } else {
                        $this->line("  Skipped {$student->first_name} {$student->last_name} - Entry already exists (Status: {$existingEntry->status})");
                        $skippedCount++;
                    }
                }
            }

            if ($shouldGenerateOverdue) {
                // Generate overdue fee entry with auto-generated receipt number
                $newFee = new Fee([
                    'academy_id' => $student->academy_id,
                    'branch_id' => $student->branch_id,
                    'student_id' => $student->id,
                    'batch_id' => $activeBatch->id,
                    'fees_amount' => $activeBatch->monthly_fee,
                    'months_paid' => 1,
                    'payment_date' => $dueDate, // Use due date as placeholder
                    'fees_from_date' => $overdueFromDate,
                    'fees_to_date' => $overdueToDate,
                    'next_installment_date' => $overdueToDate->copy()->addDay(),
                    'payment_mode' => 'cash', // Default mode, will be updated when actually paid
                    'status' => 'overdue',
                    'is_discount_applied' => false,
                    'discount_amount' => 0,
                    'fees_note' => 'Auto-generated overdue fee entry - Due Date: ' . $dueDate->format('d-M-Y'),
                    'collected_by' => null,
                ]);
                
                // Let the model's boot method generate the receipt number automatically
                $newFee->save();

                $generatedCount++;
                
                $this->line("  Generated overdue fee for: {$student->first_name} {$student->last_name} - ₹{$activeBatch->monthly_fee} (Receipt: {$newFee->receipt_number})");
                
                // Send notifications if enabled and student is overdue for specified days
                if ($sendNotifications) {
                    $daysOverdue = $dueDate->diffInDays(now());
                    if ($daysOverdue >= $notificationDays) {
                        try {
                            $student->notify(new OverdueFeeNotification($newFee, $daysOverdue));
                            $notificationsSent++;
                            $this->line("    → Notification sent to {$student->first_name} {$student->last_name}");
                        } catch (\Exception $e) {
                            $this->error("    → Failed to send notification: " . $e->getMessage());
                        }
                    }
                }
            }
            
            // Also check existing overdue fees for notifications
            if ($sendNotifications && !$shouldGenerateOverdue) {
                $existingOverdue = $student->fees()
                    ->where('status', 'overdue')
                    ->get();
                    
                foreach ($existingOverdue as $overdueFee) {
                    $daysOverdue = $overdueFee->fees_from_date->diffInDays(now());
                    if ($daysOverdue >= $notificationDays && $daysOverdue % 7 == 0) { // Send reminder every week
                        try {
                            $student->notify(new OverdueFeeNotification($overdueFee, $daysOverdue));
                            $notificationsSent++;
                            $this->line("    → Reminder sent to {$student->first_name} {$student->last_name} ({$daysOverdue} days overdue)");
                        } catch (\Exception $e) {
                            $this->error("    → Failed to send reminder: " . $e->getMessage());
                        }
                    }
                }
            }
        }

        if ($skippedCount > 0) {
            $this->info("Skipped {$skippedCount} entries (already exist as overdue/cancelled)");
        }

        return [
            'generated' => $generatedCount,
            'notifications_sent' => $notificationsSent,
            'skipped' => $skippedCount
        ];
    }
}
