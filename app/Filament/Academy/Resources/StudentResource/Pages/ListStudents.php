<?php

namespace App\Filament\Academy\Resources\StudentResource\Pages;

use App\Filament\Academy\Resources\StudentResource;
use App\Models\Academy;
use App\Models\Student;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Auth;

class ListStudents extends ListRecords
{
    protected static string $resource = StudentResource::class;

    protected function getHeaderActions(): array
    {
        $academy = Academy::find(Auth::user()->academy_id);
        $currentCount = Student::where('academy_id', Auth::user()->academy_id)
            ->where('status', 'active')
            ->count();
        $maxStudents = $academy?->max_students;

        $actions = [];

        // Show student limit info only to academy admins
        if ($maxStudents && (Auth::user()->role === 'academy_admin' || Auth::user()->is_super_admin)) {
            $actions[] = Actions\Action::make('student_limit_info')
                ->label("Active Students: {$currentCount}/{$maxStudents}")
                ->color($currentCount >= $maxStudents ? 'danger' : 'success')
                ->icon($currentCount >= $maxStudents ? 'heroicon-o-exclamation-triangle' : 'heroicon-o-information-circle')
                ->disabled()
                ->tooltip($currentCount >= $maxStudents 
                    ? 'Active student limit reached. Contact support to upgrade your plan.' 
                    : 'You can register ' . ($maxStudents - $currentCount) . ' more active student(s).'
                );
        }

        // Add create action only if limit allows
        if (static::getResource()::canCreate()) {
            $actions[] = Actions\CreateAction::make()
                ->label('Add New Student');
        }

        return $actions;
    }
}
