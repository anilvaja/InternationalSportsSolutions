<?php

namespace App\Filament\Academy\Resources\AdminResource\Pages;

use App\Filament\Academy\Resources\AdminResource;
use Filament\Resources\Pages\Page;

class AcademySettings extends Page
{
    protected static string $resource = AdminResource::class;

    protected static string $view = 'filament.academy.resources.admin-resource.pages.academy-settings';
}
