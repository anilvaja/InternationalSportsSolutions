<?php

namespace App\Filament\Resources\SuperAdminResource\Pages;

use App\Filament\Resources\SuperAdminResource;
use Filament\Resources\Pages\Page;

class SuperAdminLogin extends Page
{
    protected static string $resource = SuperAdminResource::class;

    protected static string $view = 'filament.resources.super-admin-resource.pages.super-admin-login';
}
