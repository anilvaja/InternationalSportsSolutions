<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\SyllabusTechniqueResource\Pages;
use App\Filament\Academy\Resources\SyllabusTechniqueResource\RelationManagers;
use App\Models\SyllabusTechnique;
use App\Models\SyllabusCategory;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Actions\Action;
use Filament\Tables\Filters\SelectFilter;
use Filament\Support\Enums\FontWeight;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Illuminate\Support\Facades\Auth;

class SyllabusTechniqueResource extends BaseAcademyResource
{
    protected static ?string $model = SyllabusTechnique::class;

    protected static ?string $navigationIcon = 'heroicon-o-book-open';
    
    protected static ?string $navigationGroup = 'ACADEMIC';
    
    protected static ?string $navigationLabel = 'Syllabus Techniques';
    
    protected static ?int $navigationSort = 2;

    public static function canAccess(): bool
    {
        return true; // Allow access for all academy users
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Technique Details')
                    ->description('Manage technique information and content')
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
                                    ->unique(SyllabusTechnique::class, 'slug', ignoreRecord: true)
                                    ->helperText('Used in URLs. Will be auto-generated from name.'),
                                
                                Forms\Components\Select::make('category_id')
                                    ->label('Category')
                                    ->required()
                                    ->options(function () {
                                        return SyllabusCategory::forAcademy(Auth::user()->academy_id)
                                            ->where('status', 'active')
                                            ->pluck('name', 'id');
                                    })
                                    ->searchable()
                                    ->preload(),
                                
                                Forms\Components\TextInput::make('sort_order')
                                    ->label('Sort Order')
                                    ->numeric()
                                    ->default(0)
                                    ->helperText('Higher numbers appear first')
                                    ->required(),
                                
                                Forms\Components\Select::make('difficulty_level')
                                    ->required()
                                    ->options([
                                        'beginner' => 'Beginner',
                                        'intermediate' => 'Intermediate',
                                        'advanced' => 'Advanced',
                                        'expert' => 'Expert',
                                    ])
                                    ->default('beginner'),
                                
                                Forms\Components\Select::make('belt_level')
                                    ->options([
                                        'white' => 'White Belt',
                                        'yellow' => 'Yellow Belt',
                                        'orange' => 'Orange Belt',
                                        'green' => 'Green Belt',
                                        'blue' => 'Blue Belt',
                                        'purple' => 'Purple Belt',
                                        'brown' => 'Brown Belt',
                                        'black' => 'Black Belt',
                                    ])
                                    ->searchable(),
                                
                                Forms\Components\Select::make('status')
                                    ->required()
                                    ->options([
                                        'active' => 'Active',
                                        'inactive' => 'Inactive',
                                        'draft' => 'Draft',
                                    ])
                                    ->default('active'),
                                
                                Forms\Components\TextInput::make('duration_minutes')
                                    ->label('Duration (Minutes)')
                                    ->numeric()
                                    ->suffix('minutes')
                                    ->helperText('Estimated time to learn'),
                            ]),
                        
                        Forms\Components\Textarea::make('description')
                            ->required()
                            ->maxLength(1000)
                            ->rows(3)
                            ->columnSpanFull(),
                        
                        Forms\Components\RichEditor::make('instructions')
                            ->required()
                            ->columnSpanFull()
                            ->toolbarButtons([
                                'bold', 'italic', 'underline', 'bulletList', 'orderedList', 
                                'h2', 'h3', 'link', 'blockquote', 'codeBlock'
                            ]),
                    ]),
                
                Forms\Components\Section::make('Media & Resources')
                    ->schema([
                        Forms\Components\Grid::make(2)
                            ->schema([
                                Forms\Components\FileUpload::make('featured_image')
                                    ->image()
                                    ->imageEditor()
                                    ->directory('techniques/images')
                                    ->helperText('Main technique image'),
                                
                                Forms\Components\FileUpload::make('video_url')
                                    ->label('Instruction Video')
                                    ->acceptedFileTypes(['video/mp4', 'video/avi', 'video/mov'])
                                    ->directory('techniques/videos')
                                    ->helperText('Upload technique demonstration video'),
                            ]),
                        
                        Forms\Components\FileUpload::make('images')
                            ->multiple()
                            ->image()
                            ->imageEditor()
                            ->directory('techniques/gallery')
                            ->reorderable()
                            ->columnSpanFull()
                            ->helperText('Additional technique images'),
                    ]),
                
                Forms\Components\Section::make('Additional Information')
                    ->schema([
                        Forms\Components\Toggle::make('is_featured')
                            ->label('Featured Technique')
                            ->helperText('Show prominently in featured sections'),
                        
                        Forms\Components\TagsInput::make('tags')
                            ->placeholder('Add tags...')
                            ->columnSpanFull(),
                        
                        Forms\Components\KeyValue::make('metadata')
                            ->label('Additional Metadata')
                            ->keyLabel('Property')
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
            ->heading(fn () => 'Total Techniques: ' . \App\Models\SyllabusTechnique::where('academy_id', \Illuminate\Support\Facades\Auth::user()->academy_id)->count())
            ->columns([
                Tables\Columns\ImageColumn::make('featured_image')
                    ->size(60)
                    ->circular()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('sort_order')
                    ->label('Order')
                    ->sortable()
                    ->width(80)
                    ->alignCenter(),
                
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::Bold),
                
                Tables\Columns\TextColumn::make('category.name')
                    ->label('Category')
                    ->badge()
                    ->color('info')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('difficulty_level')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'beginner' => 'success',
                        'intermediate' => 'warning',
                        'advanced' => 'danger',
                        'expert' => 'gray',
                    })
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('belt_level')
                    ->badge()
                    ->color(fn (?string $state): string => match ($state) {
                        'white' => 'gray',
                        'yellow' => 'warning',
                        'orange' => 'danger',
                        'green' => 'success',
                        'blue' => 'info',
                        'purple' => 'primary',
                        'brown' => 'warning',
                        'black' => 'gray',
                        default => 'gray',
                    })
                    ->placeholder('Not specified')
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('duration_minutes')
                    ->label('Duration')
                    ->suffix(' min')
                    ->placeholder('Not set')
                    ->toggleable(),
                
                Tables\Columns\IconColumn::make('is_featured')
                    ->boolean()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'inactive' => 'gray',
                        'draft' => 'warning',
                    })
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('category_id')
                    ->label('Category')
                    ->relationship('category', 'name')
                    ->preload(),
                
                SelectFilter::make('difficulty_level')
                    ->options([
                        'beginner' => 'Beginner',
                        'intermediate' => 'Intermediate',
                        'advanced' => 'Advanced',
                        'expert' => 'Expert',
                    ]),
                
                SelectFilter::make('belt_level')
                    ->options([
                        'white' => 'White Belt',
                        'yellow' => 'Yellow Belt',
                        'orange' => 'Orange Belt',
                        'green' => 'Green Belt',
                        'blue' => 'Blue Belt',
                        'purple' => 'Purple Belt',
                        'brown' => 'Brown Belt',
                        'black' => 'Black Belt',
                    ]),
                
                SelectFilter::make('status')
                    ->options([
                        'active' => 'Active',
                        'inactive' => 'Inactive',
                        'draft' => 'Draft',
                    ]),
                
                Tables\Filters\TernaryFilter::make('is_featured')
                    ->label('Featured Techniques'),
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
                        ->label('Activate Techniques')
                        ->icon('heroicon-o-check-circle')
                        ->color('success')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['status' => 'active']);
                            });
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\BulkAction::make('feature')
                        ->label('Mark as Featured')
                        ->icon('heroicon-o-star')
                        ->color('warning')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['is_featured' => true]);
                            });
                        })
                        ->requiresConfirmation(),
                ]),
            ])
            ->defaultSort('sort_order', 'asc')
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
            'index' => Pages\ListSyllabusTechniques::route('/'),
            'create' => Pages\CreateSyllabusTechnique::route('/create'),
            'edit' => Pages\EditSyllabusTechnique::route('/{record}/edit'),
        ];
    }
}
