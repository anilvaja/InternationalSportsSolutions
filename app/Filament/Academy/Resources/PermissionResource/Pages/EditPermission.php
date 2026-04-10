<?php

namespace App\Filament\Academy\Resources\PermissionResource\Pages;

use App\Filament\Academy\Resources\PermissionResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Auth;

class EditPermission extends EditRecord
{
    protected static string $resource = PermissionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\ViewAction::make(),
            Actions\DeleteAction::make()
                ->visible(fn () => Auth::user()->is_super_admin || Auth::user()->hasPermission('delete_permissions')),
        ];
    }
}
