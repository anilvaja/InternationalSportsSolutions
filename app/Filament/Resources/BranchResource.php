<?php

namespace App\Filament\Resources;

use App\Models\Branch;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Support\Enums\FontWeight;

class BranchResource extends Resource
{
    protected static ?string $model = Branch::class;
    protected static ?string $navigationIcon = 'heroicon-o-building-office';
    protected static ?string $navigationLabel = 'Branches';
    protected static ?string $modelLabel = 'Branch';
    protected static ?string $pluralModelLabel = 'Branches';
    protected static ?string $navigationGroup = 'Academy Data';
    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')->required(),
            Forms\Components\TextInput::make('academy_id')->required()->numeric(),
            Forms\Components\TextInput::make('address'),
            Forms\Components\TextInput::make('city'),
            Forms\Components\TextInput::make('state'),
            Forms\Components\TextInput::make('country'),
            Forms\Components\TextInput::make('status'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->heading(fn () => 'Total Branches: ' . \App\Models\Branch::count())
            ->columns([
            Tables\Columns\TextColumn::make('id')->sortable(),
            Tables\Columns\TextColumn::make('name')->searchable()->sortable()->weight(FontWeight::Bold),
            Tables\Columns\TextColumn::make('academy_info')
                ->label('Academy')
                ->getStateUsing(fn ($record) => $record->academy_id . ' - ' . optional($record->academy)->name),
            Tables\Columns\TextColumn::make('status')->badge(),
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
            'index' => BranchResource\Pages\ListBranches::route('/'),
            'view' => BranchResource\Pages\ViewBranch::route('/{record}'),
            'edit' => BranchResource\Pages\EditBranch::route('/{record}/edit'),
        ];
    }
}
