<?php

namespace App\Filament\Academy\Resources\PermissionResource\Pages;

use App\Filament\Academy\Resources\PermissionResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Auth;

class ListPermissions extends ListRecords
{
    protected static string $resource = PermissionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()
                ->visible(fn () => Auth::user()->is_super_admin || Auth::user()->hasPermission('create_permissions')),
        ];
    }
}
