<?php

namespace App\Filament\Academy\Resources\FeeResource\Pages;

use App\Filament\Academy\Resources\FeeResource;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;

class ViewFee extends ViewRecord
{
    protected static string $resource = FeeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\EditAction::make(),
            Actions\Action::make('print')
                ->label('Print Receipt')
                ->icon('heroicon-o-printer')
                ->color('success')
                ->url(fn ($record) => route('academy.fee.print', $record))
                ->openUrlInNewTab(),
        ];
    }
}
