<?php

namespace App\Filament\CentralPanel\Resources\UserResource\Pages;

use App\Filament\CentralPanel\Resources\UserResource;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;

class CreateUser extends CreateRecord
{
    protected static string $resource = UserResource::class;
}
