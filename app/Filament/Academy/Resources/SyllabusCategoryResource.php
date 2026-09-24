<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\SyllabusCategoryResource\Pages;
use App\Filament\Academy\Resources\SyllabusCategoryResource\RelationManagers;
use App\Models\SyllabusCategory;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Filters\SelectFilter;
use Filament\Support\Enums\FontWeight;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Illuminate\Support\Facades\Auth;

class SyllabusCategoryResource extends BaseAcademyResource
{
    protected static ?string $model = SyllabusCategory::class;

    protected static ?string $navigationIcon = 'heroicon-o-folder-open';
    
    protected static ?string $navigationGroup = 'ACADEMIC';
    
    protected static ?string $navigationLabel = 'Syllabus Categories';
    
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Category Details')
                    ->description('Manage syllabus category information')
                    ->schema([
                        Forms\Components\Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('name')
                                    ->required()
                                    ->maxLength(255)
                                    ->live(onBlur: true)
                                    ->afterStateUpdated(fn ($state, Forms\Set $set) => 
                                        $set('slug', \Illuminate\Support\Str::slug($state))
                                    ),
                                
                                Forms\Components\TextInput::make('slug')
                                    ->required()
                                    ->maxLength(255)
                                    ->unique(SyllabusCategory::class, 'slug', ignoreRecord: true)
                                    ->helperText('Used in URLs. Will be auto-generated from name.'),
                                
                                Forms\Components\Select::make('parent_id')
                                    ->label('Parent Category')
                                    ->options(function () {
                                        return SyllabusCategory::forAcademy(Auth::user()->academy_id)
                                            ->whereNull('parent_id')
                                            ->pluck('name', 'id');
                                    })
                                    ->searchable()
                                    ->placeholder('Select parent category (optional)')
                                    ->helperText('Leave empty for top-level category'),
                                
                                Forms\Components\Select::make('status')
                                    ->required()
                                    ->options([
                                        'active' => 'Active',
                                        'inactive' => 'Inactive',
                                    ])
                                    ->default('active'),
                            ]),
                        
                        Forms\Components\Textarea::make('description')
                            ->maxLength(1000)
                            ->rows(3)
                            ->columnSpanFull(),
                        
                        Forms\Components\Grid::make(3)
                            ->schema([
                                Forms\Components\TextInput::make('sort_order')
                                    ->numeric()
                                    ->default(0)
                                    ->helperText('Higher numbers appear first'),
                                
                                Forms\Components\ColorPicker::make('color')
                                    ->helperText('Category color for visual identification'),
                                
                                Forms\Components\FileUpload::make('icon')
                                    ->image()
                                    ->imageEditor()
                                    ->directory('syllabus-categories')
                                    ->helperText('Category icon/image'),
                            ]),
                    ]),
                
                Forms\Components\Section::make('SEO & Additional Info')
                    ->schema([
                        Forms\Components\Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('meta_title')
                                    ->maxLength(255)
                                    ->helperText('SEO title for this category'),
                                
                                Forms\Components\Textarea::make('meta_description')
                                    ->maxLength(500)
                                    ->rows(2)
                                    ->helperText('SEO description for this category'),
                            ]),
                        
                        Forms\Components\KeyValue::make('settings')
                            ->label('Additional Settings')
                            ->keyLabel('Setting')
                            ->valueLabel('Value')
                            ->columnSpanFull(),
                    ])
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->heading(fn () => 'Total Categories: ' . \App\Models\SyllabusCategory::where('academy_id', \Illuminate\Support\Facades\Auth::user()->academy_id)->count())
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::Bold),
                
                Tables\Columns\TextColumn::make('slug')
                    ->searchable()
                    ->badge()
                    ->color('gray')
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('parent.name')
                    ->label('Parent Category')
                    ->placeholder('Top Level')
                    ->sortable(),
                
                Tables\Columns\ColorColumn::make('color')
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('sort_order')
                    ->numeric()
                    ->sortable()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'inactive' => 'gray',
                    })
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('techniques_count')
                    ->counts('techniques')
                    ->label('Techniques')
                    ->badge()
                    ->color('info'),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'active' => 'Active',
                        'inactive' => 'Inactive',
                    ]),
                
                SelectFilter::make('parent_id')
                    ->label('Parent Category')
                    ->relationship('parent', 'name')
                    ->preload(),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    
                    Tables\Actions\BulkAction::make('activate')
                        ->label('Activate Categories')
                        ->icon('heroicon-o-check-circle')
                        ->color('success')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['status' => 'active']);
                            });
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\BulkAction::make('deactivate')
                        ->label('Deactivate Categories')
                        ->icon('heroicon-o-x-circle')
                        ->color('danger')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['status' => 'inactive']);
                            });
                        })
                        ->requiresConfirmation(),
                ]),
            ])
            ->defaultSort('sort_order', 'desc')
            ->reorderable('sort_order');
    }

    // Scope to current academy
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->forAcademy(Auth::user()->academy_id);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSyllabusCategories::route('/'),
            'create' => Pages\CreateSyllabusCategory::route('/create'),
            'edit' => Pages\EditSyllabusCategory::route('/{record}/edit'),
        ];
    }
}
