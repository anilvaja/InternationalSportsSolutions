<?php

namespace App\Filament\Resources;

use App\Models\SyllabusTechnique;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Forms;
use Illuminate\Database\Eloquent\Builder;
use App\Filament\Resources\SyllabusTechniqueResource\Pages;

class SyllabusTechniqueResource extends Resource
{
    protected static ?string $model = SyllabusTechnique::class;
    protected static ?string $navigationIcon = 'heroicon-o-light-bulb';
    protected static ?string $navigationGroup = 'Academy';
    protected static ?string $slug = 'syllabus-techniques';

    public static function form(Forms\Form $form): Forms\Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')->required(),
            Forms\Components\TextInput::make('academy_id')->required()->numeric(),
            Forms\Components\Textarea::make('description'),
            Forms\Components\TextInput::make('category_id')->numeric(),
        ]);
    }

    public static function table(Tables\Table $table): Tables\Table
    {
        return $table
            ->heading(fn () => 'Total Techniques: ' . \App\Models\SyllabusTechnique::count())
            ->columns([
            Tables\Columns\TextColumn::make('id')->sortable(),
            Tables\Columns\TextColumn::make('name')->searchable(),
            Tables\Columns\TextColumn::make('academy_info')
                ->label('Academy')
                ->getStateUsing(fn ($record) => $record->academy_id . ' - ' . optional($record->academy)->name),
        ])
        ->filters([
            Tables\Filters\SelectFilter::make('academy_id')
                ->label('Academy')
                ->options(\App\Models\Academy::all()->pluck('name', 'id')->toArray()),
        ])
        ->actions([
            Tables\Actions\ViewAction::make(),
            Tables\Actions\EditAction::make(),
            Tables\Actions\DeleteAction::make(),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSyllabusTechniques::route('/'),
            'create' => Pages\CreateSyllabusTechnique::route('/create'),
            'edit' => Pages\EditSyllabusTechnique::route('/{record}/edit'),
        ];
    }
}
