<?php

namespace App\Filament\Academy\Resources\OrganizationHolidayResource\Pages;

use App\Filament\Academy\Resources\OrganizationHolidayResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListOrganizationHolidays extends ListRecords
{
    protected static string $resource = OrganizationHolidayResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
