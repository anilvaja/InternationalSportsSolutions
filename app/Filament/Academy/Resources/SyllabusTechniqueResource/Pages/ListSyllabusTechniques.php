<?php

namespace App\Filament\Academy\Resources\SyllabusTechniqueResource\Pages;

use App\Filament\Academy\Resources\SyllabusTechniqueResource;
use App\Models\SyllabusTechnique;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Auth;

class ListSyllabusTechniques extends ListRecords
{
    protected static string $resource = SyllabusTechniqueResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }

    public function reorderTable(array $order): void
    {
        // Update sort_order values from 1 to n based on new position
        $academyId = Auth::user()->academy_id;
        
        foreach ($order as $index => $recordId) {
            SyllabusTechnique::where('id', $recordId)
                ->where('academy_id', $academyId)
                ->update(['sort_order' => $index + 1]);
        }
    }
}
