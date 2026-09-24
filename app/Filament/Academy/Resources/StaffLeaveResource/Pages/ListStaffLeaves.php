<?php

namespace App\Filament\Academy\Resources\StaffLeaveResource\Pages;

use App\Filament\Academy\Resources\StaffLeaveResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListStaffLeaves extends ListRecords
{
    protected static string $resource = StaffLeaveResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
