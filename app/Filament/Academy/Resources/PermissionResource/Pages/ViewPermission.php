<?php

namespace App\Filament\Academy\Resources\PermissionResource\Pages;

use App\Filament\Academy\Resources\PermissionResource;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;
use Illuminate\Support\Facades\Auth;

class ViewPermission extends ViewRecord
{
    protected static string $resource = PermissionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\EditAction::make()
                ->visible(fn () => Auth::user()->is_super_admin || Auth::user()->hasPermission('edit_permissions')),
        ];
    }
}
