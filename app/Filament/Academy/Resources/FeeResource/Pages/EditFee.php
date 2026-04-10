<?php

namespace App\Filament\Academy\Resources\FeeResource\Pages;

use App\Filament\Academy\Resources\FeeResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditFee extends EditRecord
{
    protected static string $resource = FeeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeFill(array $data): array
    {
        // Load the record with relationships
        $record = $this->getRecord();
        $record->load(['batch', 'student']);
        
        if ($record->batch) {
            // Set the monthly fee rate and original amount
            $data['monthly_fee_rate'] = $record->batch->monthly_fee;
            $data['original_fee_amount'] = $record->batch->monthly_fee * $record->months_paid;
            
            // Set display fields
            $data['batch_name'] = $record->batch->name;
            $data['monthly_fee_display'] = $record->batch->monthly_fee;
        }
        
        if ($record->student) {
            // Calculate total paid fees
            $totalPaid = $record->student->fees()->where('status', 'paid')->sum('fees_amount');
            $data['total_paid_fees'] = $totalPaid;
            
            // Set payment period info
            $lastPayment = $record->student->fees()
                ->where('status', 'paid')
                ->where('id', '!=', $record->id)
                ->orderBy('fees_to_date', 'desc')
                ->first();
            
            if ($lastPayment) {
                $lastPeriod = \Carbon\Carbon::parse($lastPayment->fees_to_date)->format('M d, Y');
                $data['payment_period_info'] = "Editing payment - Last paid till {$lastPeriod}";
            } else {
                $data['payment_period_info'] = 'Editing first payment for this student';
            }
        }
        
        return $data;
    }
}
