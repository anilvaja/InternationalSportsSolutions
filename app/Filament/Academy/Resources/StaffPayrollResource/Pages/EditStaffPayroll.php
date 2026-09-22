<?php

namespace App\Filament\Academy\Resources\StaffPayrollResource\Pages;

use App\Filament\Academy\Resources\StaffPayrollResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditStaffPayroll extends EditRecord
{
    protected static string $resource = StaffPayrollResource::class;

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
