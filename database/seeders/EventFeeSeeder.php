<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Event;
use App\Models\Student;
use App\Models\EventFee;
use App\Models\EventParticipant;

class EventFeeSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Get events with fees
        $eventsWithFees = Event::where('fee', '>', 0)->get();
        
        foreach ($eventsWithFees as $event) {
            // Get participants for this event
            $participants = EventParticipant::where('event_id', $event->id)
                ->with('student')
                ->get();
            
            foreach ($participants as $participant) {
                if ($participant->student) {
                    // Create fee record
                    EventFee::updateOrCreate([
                        'event_id' => $event->id,
                        'student_id' => $participant->student->id,
                    ], [
                        'amount' => $event->fee,
                        'final_amount' => $event->fee,
                        'payment_status' => $this->getRandomPaymentStatus(),
                        'due_date' => $event->event_date?->subDays(7),
                        'payment_method' => $this->getRandomPaymentMethod(),
                        'payment_date' => $this->getRandomPaymentDate($event),
                        'payment_reference' => $this->generatePaymentReference(),
                    ]);
                }
            }
        }
    }
    
    private function getRandomPaymentStatus(): string
    {
        $statuses = ['pending', 'paid', 'partial', 'overdue'];
        return $statuses[array_rand($statuses)];
    }
    
    private function getRandomPaymentMethod(): ?string
    {
        $methods = ['cash', 'card', 'bank_transfer', 'online', null];
        return $methods[array_rand($methods)];
    }
    
    private function getRandomPaymentDate($event): ?\Carbon\Carbon
    {
        if (rand(0, 1)) {
            return $event->event_date?->subDays(rand(1, 30));
        }
        return null;
    }
    
    private function generatePaymentReference(): ?string
    {
        if (rand(0, 1)) {
            return 'TXN' . strtoupper(uniqid());
        }
        return null;
    }
}
