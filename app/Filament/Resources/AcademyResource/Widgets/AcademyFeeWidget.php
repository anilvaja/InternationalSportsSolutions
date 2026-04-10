<?php

namespace App\Filament\Resources\AcademyResource\Widgets;

use App\Models\Fee;
use Filament\Widgets\Widget;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Card;

class AcademyFeeWidget extends StatsOverviewWidget
{
    public ?\App\Models\Academy $record = null;

    protected function getCards(): array
    {
        $academyId = $this->record->id;
        $collected = Fee::where('academy_id', $academyId)->where('status', 'paid')->sum('fees_amount');
        $pending = Fee::where('academy_id', $academyId)->where('status', 'pending')->sum('fees_amount');
        $overdue = Fee::where('academy_id', $academyId)->where('status', 'overdue')->sum('fees_amount');
        $currency = '₹';
        return [
            Card::make('Collected Fees', $currency . ' ' . number_format($collected, 2))->color('success'),
            Card::make('Pending Fees', $currency . ' ' . number_format($pending, 2))->color('warning'),
            Card::make('Overdue Fees', $currency . ' ' . number_format($overdue, 2))->color('danger'),
        ];
    }
}
