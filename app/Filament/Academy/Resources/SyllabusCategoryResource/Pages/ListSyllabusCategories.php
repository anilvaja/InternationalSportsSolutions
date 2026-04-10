<?php

namespace App\Filament\Academy\Resources\SyllabusCategoryResource\Pages;

use App\Filament\Academy\Resources\SyllabusCategoryResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListSyllabusCategories extends ListRecords
{
    protected static string $resource = SyllabusCategoryResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
