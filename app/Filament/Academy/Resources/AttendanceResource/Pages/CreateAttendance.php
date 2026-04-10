<?php

namespace App\Filament\Academy\Resources\AttendanceResource\Pages;

use App\Filament\Academy\Resources\AttendanceResource;
use App\Models\BatchAttendance;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;
use Illuminate\Database\QueryException;
use Carbon\Carbon;

class CreateAttendance extends CreateRecord
{
    protected static string $resource = AttendanceResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['academy_id'] = Auth::user()->academy_id;
        $data['attendance_marked_by'] = Auth::user()->id;
        $data['attendance_marked_at'] = now();
        
        // Check if attendance already exists for this batch and date
        $existing = BatchAttendance::where('batch_id', $data['batch_id'])
            ->where('class_date', $data['class_date'])
            ->where('academy_id', $data['academy_id'])
            ->first();
            
        if ($existing) {
            Notification::make()
                ->title('Duplicate Attendance Record')
                ->body("Cannot create: Attendance for batch ID {$data['batch_id']} on " . Carbon::parse($data['class_date'])->format('M d, Y') . " already exists (Record ID: {$existing->id}). Please choose a different date or batch.")
                ->danger()
                ->persistent()
                ->send();
                
            // Stop the form submission
            $this->halt();
        }
        
        return $data;
    }

    protected function handleRecordCreation(array $data): BatchAttendance
    {
        try {
            return parent::handleRecordCreation($data);
        } catch (QueryException $e) {
            // Handle unique constraint violations
            if ($this->isDuplicateError($e)) {
                $batchId = $data['batch_id'];
                $classDate = $data['class_date'];
                
                // Try to find the conflicting record
                $existing = BatchAttendance::where('batch_id', $batchId)
                    ->where('class_date', $classDate)
                    ->where('academy_id', $data['academy_id'])
                    ->first();
                
                $existingRecordInfo = $existing ? " (Record ID: {$existing->id})" : "";
                
                Notification::make()
                    ->title('Attendance Already Exists')
                    ->body("Cannot create: Attendance for this batch on " . Carbon::parse($classDate)->format('M d, Y (l)') . " already exists{$existingRecordInfo}. Please choose a different date.")
                    ->danger()
                    ->persistent()
                    ->send();
                
                $this->halt();
            }
            
            // Handle other database errors
            Notification::make()
                ->title('Database Error')
                ->body('An error occurred while creating attendance. Please try again or contact support if the problem persists.')
                ->danger()
                ->persistent()
                ->send();
            
            throw $e;
        }
    }

    protected function afterCreate(): void
    {
        $record = $this->record;
        
        // Since we're using relationship repeater in the form,
        // Filament automatically handles student attendance creation
        // We just need to mark attendance as taken if there are student records
        
        if ($record->studentAttendances()->exists()) {
            $record->update([
                'attendance_taken' => true,
            ]);
        }
    }

    /**
     * Check if the exception is a duplicate/unique constraint error
     */
    private function isDuplicateError(QueryException $e): bool
    {
        $errorCode = $e->getCode();
        $errorMessage = strtolower($e->getMessage());
        
        // MySQL duplicate entry error
        if ($errorCode == 23000 || strpos($errorMessage, 'duplicate entry') !== false) {
            return true;
        }
        
        // MySQL unique constraint violation
        if (strpos($errorMessage, 'unique_batch_date') !== false) {
            return true;
        }
        
        // SQLite unique constraint error
        if ($errorCode == 19 || strpos($errorMessage, 'unique constraint') !== false) {
            return true;
        }
        
        // PostgreSQL unique violation
        if ($errorCode == 23505 || strpos($errorMessage, 'unique violation') !== false) {
            return true;
        }
        
        return false;
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
