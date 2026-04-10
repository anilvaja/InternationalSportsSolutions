<?php

namespace App\Filament\Academy\Resources\EventFeeResource\Pages;

use App\Filament\Academy\Resources\EventFeeResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditEventFee extends EditRecord
{
    protected static string $resource = EventFeeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
