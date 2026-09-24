<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\AuditResource\Pages;
use App\Models\Audit;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

class AuditResource extends BaseAcademyResource
{
    protected static ?string $model = Audit::class;
    protected static ?string $navigationIcon = 'heroicon-o-shield-check';
    protected static ?string $navigationLabel = 'Activity & Audit Logs';
    protected static ?string $navigationGroup = 'ADMINISTRATION';
    protected static ?int $navigationSort = 4;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('event')
                    ->disabled(),
                Forms\Components\TextInput::make('subject_type')
                    ->label('Model')
                    ->disabled(),
                Forms\Components\TextInput::make('user_name')
                    ->disabled(),
                Forms\Components\Textarea::make('properties')
                    ->label('Log Details / Properties')
                    ->disabled()
                    ->formatStateUsing(fn ($state) => json_encode($state, JSON_PRETTY_PRINT)),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('ID')
                    ->sortable(),
                
                Tables\Columns\BadgeColumn::make('event')
                    ->label('Action')
                    ->getStateUsing(fn ($record) => $record->event ?? $record->description ?? 'logged')
                    ->colors([
                        'success' => 'created',
                        'warning' => 'updated',
                        'danger' => 'deleted',
                        'info' => 'restored',
                    ]),
                
                Tables\Columns\TextColumn::make('model_name')
                    ->label('Model')
                    ->sortable()
                    ->searchable(),
                
                Tables\Columns\TextColumn::make('subject_id')
                    ->label('Record ID')
                    ->getStateUsing(fn ($record) => $record->subject_id ?? $record->auditable_id ?? '-')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('user_name')
                    ->label('User')
                    ->sortable()
                    ->searchable(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Date/Time')
                    ->dateTime('d M Y, H:i:s')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\Filter::make('date_range')
                    ->form([
                        Forms\Components\DatePicker::make('from'),
                        Forms\Components\DatePicker::make('until'),
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        return $query
                            ->when(
                                $data['from'],
                                fn (Builder $query, $date): Builder => $query->whereDate('created_at', '>=', $date),
                            )
                            ->when(
                                $data['until'],
                                fn (Builder $query, $date): Builder => $query->whereDate('created_at', '<=', $date),
                            );
                    }),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
            ])
            ->defaultSort('created_at', 'desc')
            ->poll('30s');
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery();
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAudits::route('/'),
            'view' => Pages\ViewAudit::route('/{record}'),
        ];
    }
}
