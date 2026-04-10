<?php

namespace App\Filament\Academy\Resources\AcademyRoleResource\Pages;

use App\Filament\Academy\Resources\AcademyRoleResource;
use App\Rules\UniqueAcademyRoleName;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Facades\Auth;

class CreateAcademyRole extends CreateRecord
{
    protected static string $resource = AcademyRoleResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        // Ensure academy_id is set to current user's academy
        $data['academy_id'] = Auth::user()->academy_id;
        
        return $data;
    }

    protected function getCreationFormValidationRules(): array
    {
        return [
            'data.name' => [
                'required',
                'string',
                'max:255',
                new UniqueAcademyRoleName(Auth::user()->academy_id)
            ],
        ];
    }
}
