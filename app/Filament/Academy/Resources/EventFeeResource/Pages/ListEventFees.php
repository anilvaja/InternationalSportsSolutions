<?php

namespace App\Filament\Academy\Resources\EventFeeResource\Pages;

use App\Filament\Academy\Resources\EventFeeResource;
use App\Filament\Academy\Widgets\EventFeeStats;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Artisan;

class ListEventFees extends ListRecords
{
    protected static string $resource = EventFeeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
            
            Actions\Action::make('update_overdue')
                ->label('Update Overdue Fees')
                ->icon('heroicon-o-clock')
                ->color('warning')
                ->action(function () {
                    Artisan::call('fees:update-overdue');
                    \Filament\Notifications\Notification::make()
                        ->success()
                        ->title('Overdue fees updated')
                        ->body('All overdue fees have been processed.')
                        ->send();
                })
                ->requiresConfirmation()
                ->modalHeading('Update Overdue Fees')
                ->modalDescription('This will mark all pending fees past their due date as overdue and calculate late fees.'),
        ];
    }
    
    protected function getHeaderWidgets(): array
    {
        return [
            EventFeeStats::class,
        ];
    }
}
