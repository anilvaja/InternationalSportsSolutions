<?php

namespace App\Filament\Academy\Resources\StudentResource\Pages;

use App\Filament\Academy\Resources\StudentResource;
use App\Models\Academy;
use App\Models\Student;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Auth;

class CreateStudent extends CreateRecord
{
    protected static string $resource = StudentResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        // Set the academy_id from the current user
        $data['academy_id'] = Auth::user()->academy_id;
        
        // Ensure the selected branch belongs to the current academy
        $branch = \App\Models\Branch::find($data['branch_id']);
        if (!$branch || $branch->academy_id !== Auth::user()->academy_id) {
            throw new \Exception('Invalid branch selected');
        }
        
        return $data;
    }

    protected function beforeCreate(): void
    {
        $academy = Academy::find(Auth::user()->academy_id);
        $currentStudentCount = Student::where('academy_id', Auth::user()->academy_id)
            ->where('status', 'active')
            ->count();

        if ($academy && $academy->max_students && $currentStudentCount >= $academy->max_students) {
            Notification::make()
                ->title('Student Limit Reached')
                ->body("Your academy is limited to {$academy->max_students} active student(s). You currently have {$currentStudentCount} active students. Please contact support to upgrade your plan.")
                ->danger()
                ->persistent()
                ->send();

            $this->halt();
        }
    }
}
