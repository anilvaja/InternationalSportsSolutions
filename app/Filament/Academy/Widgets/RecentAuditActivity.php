<?php

namespace App\Filament\Academy\Widgets;

use App\Models\Audit;
use App\Support\AcademyPermissionHelper;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;

class RecentAuditActivity extends BaseWidget
{
    protected static ?string $heading = 'Recent Activity';
    protected int | string | array $columnSpan = 'full';
    
    public static function canView(): bool
    {
        // Users need general view permission for audits/activity logs
        return AcademyPermissionHelper::can('view_audits');
    }
    
    public function table(Table $table): Table
    {
        // Only show last 1 day's activities and only for fees and batch models
        $oneDayAgo = now()->subDay(30);
        $feeModels = [
            'App\\Models\\Fee',
            'App\\Models\\Payment',
            // Add other fee-related models if needed
        ];
        $batchModels = [
            'App\\Models\\Batch',
            // Add other batch-related models if needed
        ];
        $allowedModels = array_merge($feeModels, $batchModels);
        return $table
            ->query(
                Audit::query()
                    ->where('created_at', '>=', $oneDayAgo)
                    ->whereIn('auditable_type', $allowedModels)
                    ->latest()
                    ->limit(50)
            )
            ->columns([
                Tables\Columns\BadgeColumn::make('event')
                    ->label('Action')
                    ->colors([
                        'success' => 'created',
                        'warning' => 'updated',
                        'danger' => 'deleted',
                        'info' => 'restored',
                    ]),
                
                Tables\Columns\TextColumn::make('model_name')
                    ->label('Model'),
                
                Tables\Columns\TextColumn::make('auditable_id')
                    ->label('ID'),
                
                Tables\Columns\TextColumn::make('user_name')
                    ->label('User'),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Time')
                    ->since()
                    ->sortable(),
            ])
            ->actions([
                Tables\Actions\Action::make('view')
                    ->label('View')
                    ->icon('heroicon-o-eye')
                    ->url(fn (Audit $record) => route('filament.academy.resources.audits.view', $record))
                    ->visible(fn () => AcademyPermissionHelper::can('view_audits')),
            ])
            ->paginated(false)
            ->poll('30s');
    }
}
