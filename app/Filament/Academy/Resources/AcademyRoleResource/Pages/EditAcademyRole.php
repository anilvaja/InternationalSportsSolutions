<?php

namespace App\Filament\Academy\Resources\AcademyRoleResource\Pages;

use App\Filament\Academy\Resources\AcademyRoleResource;
use App\Rules\UniqueAcademyRoleName;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Auth;

class EditAcademyRole extends EditRecord
{
    protected static string $resource = AcademyRoleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeFill(array $data): array
    {
        return $data;
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        // Ensure academy_id is set to current user's academy
        $data['academy_id'] = Auth::user()->academy_id;
        
        return $data;
    }

    protected function getFormValidationRules(): array
    {
        return [
            'data.name' => [
                'required',
                'string',
                'max:255',
                new UniqueAcademyRoleName(Auth::user()->academy_id, $this->record->id)
            ],
        ];
    }
}
