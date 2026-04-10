<?php

namespace App\Filament\Resources;

use App\Models\Batch;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Support\Enums\FontWeight;

class BatchResource extends Resource
{
    protected static ?string $model = Batch::class;
    protected static ?string $navigationIcon = 'heroicon-o-user-group';
    protected static ?string $navigationLabel = 'Batches';
    protected static ?string $modelLabel = 'Batch';
    protected static ?string $pluralModelLabel = 'Batches';
    protected static ?string $navigationGroup = 'Academy Data';
    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')->required(),
            Forms\Components\TextInput::make('academy_id')->required()->numeric(),
            Forms\Components\TextInput::make('branch_id')->required()->numeric(),
            Forms\Components\TextInput::make('description'),
            Forms\Components\DatePicker::make('start_date'),
            Forms\Components\DatePicker::make('end_date'),
            Forms\Components\TextInput::make('status'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->heading(fn () => 'Total Batches: ' . \App\Models\Batch::count())
            ->columns([
            Tables\Columns\TextColumn::make('id')->sortable(),
            Tables\Columns\TextColumn::make('name')->searchable()->sortable()->weight(FontWeight::Bold),
            Tables\Columns\TextColumn::make('academy_info')
                ->label('Academy')
                ->getStateUsing(fn ($record) => $record->academy_id . ' - ' . optional($record->academy)->name),
            Tables\Columns\TextColumn::make('branch_info')
                ->label('Branch')
                ->getStateUsing(fn ($record) => $record->branch_id . ' - ' . optional($record->branch)->name),
            Tables\Columns\TextColumn::make('created_at')->dateTime()->sortable(),
        ])
        ->actions([
            Tables\Actions\ViewAction::make(),
            Tables\Actions\EditAction::make(),
            Tables\Actions\DeleteAction::make(),
        ])
        ->defaultSort('created_at', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => BatchResource\Pages\ListBatches::route('/'),
            'view' => BatchResource\Pages\ViewBatch::route('/{record}'),
            'edit' => BatchResource\Pages\EditBatch::route('/{record}/edit'),
        ];
    }
}
