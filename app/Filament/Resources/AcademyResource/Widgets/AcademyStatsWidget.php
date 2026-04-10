<?php

namespace App\Filament\Resources\AcademyResource\Widgets;

use App\Models\Academy;
use App\Models\Branch;
use App\Models\Batch;
use App\Models\User;
use App\Models\Student;
use Filament\Widgets\Widget;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Card;
use Filament\Tables\Actions\Action;

class AcademyStatsWidget extends StatsOverviewWidget
{
    public ?Academy $record = null;

    protected function getCards(): array
    {
        $academy = $this->record;
        return [
            Card::make('Branches', Branch::where('academy_id', $academy->id)->count())
                ->description('View all branches')
                ->color('primary')
                ->url(route('filament.admin.resources.branches.index', ['tableFilters[academy_id][value]' => $academy->id]), true),
            Card::make('Batches', Batch::where('academy_id', $academy->id)->count())
                ->description('View all batches')
                ->color('info')
                ->url(route('filament.admin.resources.batches.index', ['tableFilters[academy_id][value]' => $academy->id]), true),
            Card::make('Users', User::where('academy_id', $academy->id)->count())
                ->description('View all users')
                ->color('success')
                ->url(route('filament.admin.resources.users.index', ['tableFilters[academy_id][value]' => $academy->id]), true),
            Card::make('Students', Student::where('academy_id', $academy->id)->count())
                ->description('View all students')
                ->color('warning')
                ->url(route('filament.admin.resources.students.index', ['tableFilters[academy_id][value]' => $academy->id]), true),
        ];
    }
}
