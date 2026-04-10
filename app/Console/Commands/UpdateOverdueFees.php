<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Event;
use App\Models\EventFee;

class UpdateOverdueFees extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'fees:update-overdue {--event-id= : Specific event ID to update}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Update overdue event fees and calculate late fees';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $eventId = $this->option('event-id');
        $totalUpdated = 0;
        
        if ($eventId) {
            // Update for specific event
            $event = Event::find($eventId);
            if (!$event) {
                $this->error("Event with ID {$eventId} not found.");
                return 1;
            }
            
            $updated = $event->updateOverdueFees();
            $totalUpdated += $updated;
            
            $this->info("Updated {$updated} overdue fees for event: {$event->title}");
        } else {
            // Update for all events
            $events = Event::with('fees')->get();
            
            foreach ($events as $event) {
                $updated = $event->updateOverdueFees();
                $totalUpdated += $updated;
                
                if ($updated > 0) {
                    $this->info("Updated {$updated} overdue fees for event: {$event->title}");
                }
            }
        }
        
        $this->info("Total overdue fees updated: {$totalUpdated}");
        
        // Show summary
        $this->showSummary();
        
        return 0;
    }
    
    private function showSummary()
    {
        $this->newLine();
        $this->info('Fee Summary:');
        
        $pendingCount = EventFee::where('payment_status', 'pending')->count();
        $paidCount = EventFee::where('payment_status', 'paid')->count();
        $overdueCount = EventFee::where('payment_status', 'overdue')->count();
        $totalRevenue = EventFee::where('payment_status', 'paid')->sum('final_amount');
        $pendingRevenue = EventFee::whereIn('payment_status', ['pending', 'overdue'])->sum('final_amount');
        
        $this->table(
            ['Status', 'Count', 'Amount'],
            [
                ['Pending', $pendingCount, '$' . number_format(EventFee::where('payment_status', 'pending')->sum('final_amount'), 2)],
                ['Paid', $paidCount, '$' . number_format($totalRevenue, 2)],
                ['Overdue', $overdueCount, '$' . number_format(EventFee::where('payment_status', 'overdue')->sum('final_amount'), 2)],
                ['Total Pending Revenue', '', '$' . number_format($pendingRevenue, 2)],
            ]
        );
    }
}
