<?php

namespace App\Filament\Academy\Resources\UserResource\Pages;

use App\Filament\Academy\Resources\UserResource;
use App\Models\UserAcademyRole;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Facades\Auth;

class CreateUser extends CreateRecord
{
    protected static string $resource = UserResource::class;

    protected function afterCreate(): void
    {
        $data = $this->form->getState();
        
        // Assign the academy role to the user
        if (isset($data['academy_role_id']) && $data['academy_role_id']) {
            UserAcademyRole::create([
                'user_id' => $this->record->id,
                'academy_id' => Auth::user()->academy_id,
                'academy_role_id' => $data['academy_role_id'],
                'is_active' => true,
                'assigned_at' => now(),
                'additional_permissions' => [],
            ]);
        }
    }
}
