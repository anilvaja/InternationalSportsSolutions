<?php

namespace App\Filament\Resources\AcademyResource\Pages;

use App\Filament\Resources\AcademyResource;
use Filament\Resources\Pages\ViewRecord;
use Filament\Widgets\Widget;
use Filament\Pages\Actions\Action;

class ViewAcademy extends ViewRecord
{
    protected static string $resource = AcademyResource::class;

    protected function getHeaderWidgets(): array
    {
        return [
            // Add widget classes here (to be created)
            \App\Filament\Resources\AcademyResource\Widgets\AcademyStatsWidget::class,
            \App\Filament\Resources\AcademyResource\Widgets\AcademyFeeWidget::class,
            \App\Filament\Resources\AcademyResource\Widgets\AcademySyllabusWidget::class,
        ];
    }
}
