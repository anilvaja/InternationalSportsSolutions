<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Branch;
use App\Support\AcademyPermissionHelper;
use Filament\Widgets\Widget;
use Illuminate\Support\Facades\Auth;

class AcademyHeaderWidget extends Widget
{
    protected static string $view = 'filament.academy.widgets.academy-header-widget';

    protected int | string | array $columnSpan = 'full';

    protected static ?int $sort = -10;

    public ?string $selectedBranchId = 'all';

    public function getBranches(): array
    {
        $user = Auth::user();
        if (!$user) return [];

        return Branch::where('academy_id', $user->academy_id)
            ->pluck('name', 'id')
            ->toArray();
    }

    public function updatedSelectedBranchId($value): void
    {
        session(['dashboard_selected_branch_id' => $value]);
        $this->dispatch('dashboard_branch_changed', branchId: $value);
    }
}
