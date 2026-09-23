<?php

namespace App\Filament\Academy\Resources\StaffAttendanceSettingResource\Pages;

use App\Filament\Academy\Resources\StaffAttendanceSettingResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListStaffAttendanceSettings extends ListRecords
{
    protected static string $resource = StaffAttendanceSettingResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()
                ->label('Configure Staff Rule'),
        ];
    }
}
