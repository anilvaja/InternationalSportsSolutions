<?php

namespace App\Filament\Academy\Resources\StaffAttendanceCorrectionResource\Pages;

use App\Filament\Academy\Resources\StaffAttendanceCorrectionResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListStaffAttendanceCorrections extends ListRecords
{
    protected static string $resource = StaffAttendanceCorrectionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
