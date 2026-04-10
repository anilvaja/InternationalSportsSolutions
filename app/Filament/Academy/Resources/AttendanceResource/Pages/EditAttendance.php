<?php

namespace App\Filament\Academy\Resources\AttendanceResource\Pages;

use App\Filament\Academy\Resources\AttendanceResource;
use App\Models\BatchAttendance;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;
use Illuminate\Database\QueryException;

class EditAttendance extends EditRecord
{
    protected static string $resource = AttendanceResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        // Ensure academy_id is always set
        $data['academy_id'] = Auth::user()->academy_id;
        
        // Update the marked by information when attendance is modified
        $data['attendance_marked_by'] = Auth::user()->id;
        $data['attendance_marked_at'] = now();
        
        // Check for duplicate only if batch_id or class_date changed
        if (isset($data['batch_id']) && isset($data['class_date'])) {
            $existing = BatchAttendance::where('batch_id', $data['batch_id'])
                ->where('class_date', $data['class_date'])
                ->where('academy_id', $data['academy_id'])
                ->where('id', '!=', $this->record->id) // Exclude current record
                ->first();
                
            if ($existing) {
                Notification::make()
                    ->title('Duplicate Attendance Record')
                    ->body("Cannot update: Attendance for batch ID {$data['batch_id']} on " . \Carbon\Carbon::parse($data['class_date'])->format('M d, Y') . " already exists (Record ID: {$existing->id}). Please choose a different date or batch.")
                    ->danger()
                    ->persistent()
                    ->send();
                    
                $this->halt();
            }
        }
        
        return $data;
    }

    protected function handleRecordUpdate($record, array $data): BatchAttendance
    {
        try {
            return parent::handleRecordUpdate($record, $data);
        } catch (QueryException $e) {
            // Handle unique constraint violations
            if ($this->isDuplicateError($e)) {
                $batchId = $data['batch_id'] ?? $record->batch_id;
                $classDate = $data['class_date'] ?? $record->class_date;
                
                // Try to find the conflicting record
                $existing = BatchAttendance::where('batch_id', $batchId)
                    ->where('class_date', $classDate)
                    ->where('academy_id', $data['academy_id'])
                    ->where('id', '!=', $record->id)
                    ->first();
                
                $existingRecordInfo = $existing ? " (Record ID: {$existing->id})" : "";
                
                Notification::make()
                    ->title('Attendance Already Exists')
                    ->body("Cannot save: Attendance for this batch on " . \Carbon\Carbon::parse($classDate)->format('M d, Y (l)') . " already exists{$existingRecordInfo}. Please choose a different date.")
                    ->danger()
                    ->persistent()
                    ->send();
                
                $this->halt();
            }
            
            // Handle other database errors
            Notification::make()
                ->title('Database Error')
                ->body('An error occurred while saving attendance. Please try again or contact support if the problem persists.')
                ->danger()
                ->persistent()
                ->send();
            
            throw $e;
        }
    }

    protected function afterSave(): void
    {
        $record = $this->record;
        
        // Since we're using relationship repeater in the form,
        // Filament automatically handles student attendance updates
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
