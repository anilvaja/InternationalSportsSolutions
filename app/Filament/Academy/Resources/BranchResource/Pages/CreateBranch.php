<?php

namespace App\Filament\Academy\Resources\BranchResource\Pages;

use App\Filament\Academy\Resources\BranchResource;
use App\Models\Academy;
use App\Models\Branch;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Auth;

class CreateBranch extends CreateRecord
{
    protected static string $resource = BranchResource::class;

    public function mount(): void
    {
        // Check branch limit before allowing access to create page
        $academy = Academy::find(Auth::user()->academy_id);
        $currentBranchCount = Branch::where('academy_id', Auth::user()->academy_id)
            ->where('status', 'active')
            ->count();

        if ($academy && $academy->max_branches && $currentBranchCount >= $academy->max_branches) {
            Notification::make()
                ->title('Branch Limit Reached')
                ->body("Cannot create new branch. Your academy is limited to {$academy->max_branches} active branch(es). You currently have {$currentBranchCount} active branches. Please deactivate existing branches or contact support to upgrade your plan.")
                ->danger()
                ->persistent()
                ->send();

            // Redirect back to list page
            $this->redirect(static::getResource()::getUrl('index'));
            return;
        }

        parent::mount();
    }

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['academy_id'] = Auth::user()->academy_id;
        return $data;
    }

    protected function beforeCreate(): void
    {
        $academy = Academy::find(Auth::user()->academy_id);
        $currentBranchCount = Branch::where('academy_id', Auth::user()->academy_id)
            ->where('status', 'active')
            ->count();

        if ($academy && $academy->max_branches && $currentBranchCount >= $academy->max_branches) {
            Notification::make()
                ->title('Branch Limit Reached')
                ->body("Your academy is limited to {$academy->max_branches} active branch(es). You currently have {$currentBranchCount} active branches. Please contact support to upgrade your plan.")
                ->danger()
                ->persistent()
                ->send();

            $this->halt();
        }
    }
}
