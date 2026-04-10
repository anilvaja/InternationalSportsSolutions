<?php

namespace App\Filament\Academy\Resources\AcademyRoleResource\Pages;

use App\Filament\Academy\Resources\AcademyRoleResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListAcademyRoles extends ListRecords
{
    protected static string $resource = AcademyRoleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
