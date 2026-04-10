<?php

namespace App\Filament\Academy\Resources\FeeResource\Pages;

use App\Filament\Academy\Resources\FeeResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListFees extends ListRecords
{
    protected static string $resource = FeeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
