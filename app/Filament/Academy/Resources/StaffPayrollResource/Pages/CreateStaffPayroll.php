<?php

namespace App\Filament\Academy\Resources\StaffPayrollResource\Pages;

use App\Filament\Academy\Resources\StaffPayrollResource;
use Filament\Resources\Pages\CreateRecord;

class CreateStaffPayroll extends CreateRecord
{
    protected static string $resource = StaffPayrollResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
