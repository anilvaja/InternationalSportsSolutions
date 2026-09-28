<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Audit;
use App\Support\AcademyPermissionHelper;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Support\Facades\Auth;

class RecentAuditActivity extends BaseWidget
{
    protected static ?string $heading = 'Recent Audit & Activity Log';
    protected int | string | array $columnSpan = 'full';
    protected static ?int $sort = -1;
    
    public static function canView(): bool
    {
        return AcademyPermissionHelper::can('view_audits');
    }
    
    public function table(Table $table): Table
    {
        $oneMonthAgo = now()->subDays(30);

        return $table
            ->query(
                Audit::query()
                    ->forUserAccess()
                    ->where('created_at', '>=', $oneMonthAgo)
                    ->latest()
                    ->limit(50)
            )
            ->columns([
                Tables\Columns\BadgeColumn::make('event')
                    ->label('Action')
                    ->getStateUsing(fn ($record) => ucfirst($record->event ?? 'logged'))
                    ->colors([
                        'success' => 'Created',
                        'warning' => 'Updated',
                        'danger' => 'Deleted',
                        'info' => 'Restored',
                    ]),
                
                Tables\Columns\TextColumn::make('model_name')
                    ->label('Entity'),
                
                Tables\Columns\TextColumn::make('auditable_id')
                    ->label('Record ID')
                    ->getStateUsing(fn ($record) => $record->auditable_id ?? '-'),
                
                Tables\Columns\TextColumn::make('user_name')
                    ->label('Performed By'),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Time')
                    ->since()
                    ->sortable(),
            ])
            ->actions([
                Tables\Actions\Action::make('view')
                    ->label('View Audit')
                    ->icon('heroicon-o-eye')
                    ->url(fn (Audit $record) => \App\Filament\Academy\Resources\AuditResource::getUrl('view', ['record' => $record]))
                    ->visible(fn () => AcademyPermissionHelper::can('view_audits')),
            ])
            ->paginated(false)
            ->poll('30s');
    }
}

