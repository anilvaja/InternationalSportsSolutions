<?php

namespace App\Filament\Academy\Resources\UserResource\Pages;

use App\Filament\Academy\Resources\UserResource;
use App\Models\UserAcademyRole;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Auth;

class EditUser extends EditRecord
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeFill(array $data): array
    {
        // Load current academy role
        $userRole = $this->record->activeAcademyRoles()
            ->with('academyRole')
            ->forAcademy(Auth::user()->academy_id)
            ->first();

        if ($userRole && $userRole->academyRole) {
            $data['academy_role_id'] = $userRole->academy_role_id;
            // Also load additional permissions if they exist
            $data['additional_permissions'] = $userRole->additional_permissions ?? [];
        } else {
            $data['academy_role_id'] = null;
            $data['additional_permissions'] = [];
        }

        return $data;
    }

    protected function afterSave(): void
    {
        $data = $this->form->getState();
        $currentUser = Auth::user();
        
        // Skip role management if user is editing themselves
        if ($currentUser && $currentUser->id === $this->record->id) {
            return; // Don't modify roles when self-editing
        }
        
        // Update the academy role assignment for admin edits
        $academyId = $currentUser->academy_id;
        
        // Remove existing roles for this academy
        $this->record->userAcademyRoles()
            ->where('academy_id', $academyId)
            ->delete();
        
        // Assign new role if provided
        if (isset($data['academy_role_id']) && $data['academy_role_id']) {
            UserAcademyRole::create([
                'user_id' => $this->record->id,
                'academy_id' => $academyId,
                'academy_role_id' => $data['academy_role_id'],
                'is_active' => true,
                'assigned_at' => now(),
                'additional_permissions' => $data['additional_permissions'] ?? [],
            ]);
        }
    }
}
