<?php

namespace App\Filament\Admin\Widgets;

use App\Models\Audit;
use Filament\Forms;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Filament\Support\Enums\FontWeight;

class SystemAuditActivityWidget extends BaseWidget
{
    protected static ?int $sort = 3;
    protected int|string|array $columnSpan = 'full';
    protected static ?string $heading = 'Recent System & Academies Activity Feed';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                Audit::query()
                    ->latest('created_at')
                    ->limit(10)
            )
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('Log ID')
                    ->sortable(),

                Tables\Columns\BadgeColumn::make('event')
                    ->label('Action')
                    ->getStateUsing(fn ($record) => $record->event ?? 'logged')
                    ->colors([
                        'success' => 'created',
                        'warning' => 'updated',
                        'danger' => 'deleted',
                        'info' => 'restored',
                    ]),

                Tables\Columns\TextColumn::make('model_name')
                    ->label('Target Model')
                    ->weight(FontWeight::Bold)
                    ->sortable()
                    ->searchable(),

                Tables\Columns\TextColumn::make('auditable_id')
                    ->label('Record ID')
                    ->sortable(),

                Tables\Columns\TextColumn::make('user_name')
                    ->label('Causer / User')
                    ->badge()
                    ->color('info')
                    ->sortable()
                    ->searchable(),

                Tables\Columns\TextColumn::make('ip_address')
                    ->label('IP Address')
                    ->toggleable(isToggledHiddenByDefault: true),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('Timestamp')
                    ->dateTime('d M Y, H:i:s')
                    ->sortable(),
            ])
            ->actions([
                Tables\Actions\Action::make('view_details')
                    ->label('Details')
                    ->icon('heroicon-o-eye')
                    ->modalHeading(fn ($record) => "Audit Log #{$record->id} - {$record->event} {$record->model_name}")
                    ->form([
                        Forms\Components\TextInput::make('event')->label('Event Action')->disabled(),
                        Forms\Components\TextInput::make('model_name')->label('Target Model')->disabled(),
                        Forms\Components\TextInput::make('auditable_id')->label('Record ID')->disabled(),
                        Forms\Components\TextInput::make('user_name')->label('User')->disabled(),
                        Forms\Components\TextInput::make('ip_address')->label('IP Address')->disabled(),
                        Forms\Components\TextInput::make('url')->label('URL')->disabled(),
                        Forms\Components\Textarea::make('old_values')
                            ->label('Old Values')
                            ->disabled()
                            ->columnSpanFull()
                            ->formatStateUsing(fn ($state) => is_array($state) ? json_encode($state, JSON_PRETTY_PRINT) : $state),
                        Forms\Components\Textarea::make('new_values')
                            ->label('New Values')
                            ->disabled()
                            ->columnSpanFull()
                            ->formatStateUsing(fn ($state) => is_array($state) ? json_encode($state, JSON_PRETTY_PRINT) : $state),
                    ])
                    ->modalSubmitAction(false),
            ]);
    }
}
