<?php

namespace App\Filament\Resources\AcademyResource\Pages;

use App\Filament\Resources\AcademyResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListAcademies extends ListRecords
{
    protected static string $resource = AcademyResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
