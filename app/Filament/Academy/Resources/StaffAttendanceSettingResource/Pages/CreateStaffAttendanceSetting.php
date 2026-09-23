<?php

namespace App\Filament\Academy\Resources\StaffAttendanceSettingResource\Pages;

use App\Filament\Academy\Resources\StaffAttendanceSettingResource;
use Filament\Resources\Pages\CreateRecord;

class CreateStaffAttendanceSetting extends CreateRecord
{
    protected static string $resource = StaffAttendanceSettingResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
