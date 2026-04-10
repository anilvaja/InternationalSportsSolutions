<?php

namespace App\Filament\Academy\Resources\AuditResource\Pages;

use App\Filament\Academy\Resources\AuditResource;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;

class CreateAudit extends CreateRecord
{
    protected static string $resource = AuditResource::class;
}
