<?php

namespace App\Filament\Academy\Resources\SyllabusCategoryResource\Pages;

use App\Filament\Academy\Resources\SyllabusCategoryResource;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Facades\Auth;

class CreateSyllabusCategory extends CreateRecord
{
    protected static string $resource = SyllabusCategoryResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['academy_id'] = Auth::user()->academy_id;
        return $data;
    }
}
