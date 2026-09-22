<?php

namespace App\Filament\Academy\Resources\StaffAttendanceResource\Pages;

use App\Filament\Academy\Resources\StaffAttendanceResource;
use Filament\Resources\Pages\CreateRecord;

class CreateStaffAttendance extends CreateRecord
{
    protected static string $resource = StaffAttendanceResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
