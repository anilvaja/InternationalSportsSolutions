<?php

namespace App\Filament\Academy\Resources\SyllabusTechniqueResource\Pages;

use App\Filament\Academy\Resources\SyllabusTechniqueResource;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Facades\Auth;

class CreateSyllabusTechnique extends CreateRecord
{
    protected static string $resource = SyllabusTechniqueResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['academy_id'] = Auth::user()->academy_id;
        return $data;
    }
}
