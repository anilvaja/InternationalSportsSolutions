<?php

namespace App\Filament\Academy\Resources\StaffAttendanceResource\Pages;

use App\Filament\Academy\Resources\StaffAttendanceResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditStaffAttendance extends EditRecord
{
    protected static string $resource = StaffAttendanceResource::class;

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
