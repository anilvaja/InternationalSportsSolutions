<?php

namespace App\Filament\Academy\Resources\SyllabusTechniqueResource\Pages;

use App\Filament\Academy\Resources\SyllabusTechniqueResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditSyllabusTechnique extends EditRecord
{
    protected static string $resource = SyllabusTechniqueResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
