<?php

namespace App\Filament\Academy\Resources\BranchResource\Pages;

use App\Filament\Academy\Resources\BranchResource;
use App\Models\Academy;
use App\Models\Branch;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Auth;

class ListBranches extends ListRecords
{
    protected static string $resource = BranchResource::class;

    protected function getHeaderActions(): array
    {
        $academy = Academy::find(Auth::user()->academy_id);
        $currentCount = Branch::where('academy_id', Auth::user()->academy_id)
            ->where('status', 'active')
            ->count();
        $maxBranches = $academy?->max_branches;

        $actions = [];

        // Show branch limit info only to academy admins
        if ($maxBranches && (Auth::user()->role === 'academy_admin' || Auth::user()->is_super_admin)) {
            $limitReached = $currentCount >= $maxBranches;
            
            $actions[] = Actions\Action::make('branch_limit_info')
                ->label("Active Branches: {$currentCount}/{$maxBranches}" . ($limitReached ? ' (Limit Reached)' : ''))
                ->color($limitReached ? 'danger' : 'success')
                ->icon($limitReached ? 'heroicon-o-exclamation-triangle' : 'heroicon-o-information-circle')
                ->disabled()
                ->tooltip($limitReached 
                    ? 'Active branch limit reached. Deactivate existing branches or contact support to upgrade your plan.' 
                    : 'You can create ' . ($maxBranches - $currentCount) . ' more active branch(es).'
                );
        }

        // Add create action only if limit allows
        if (static::getResource()::canCreate()) {
            // Check if branch limit has been reached
            if ($maxBranches && $currentCount >= $maxBranches) {
                // Don't show create button if limit is reached
            } else {
                // Show create button if under limit or no limit set
                $actions[] = Actions\CreateAction::make();
            }
        }

        return $actions;
    }
}
