<?php

namespace App\Filament\Academy\Resources\StaffAttendanceSettingResource\Pages;

use App\Filament\Academy\Resources\StaffAttendanceSettingResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditStaffAttendanceSetting extends EditRecord
{
    protected static string $resource = StaffAttendanceSettingResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
