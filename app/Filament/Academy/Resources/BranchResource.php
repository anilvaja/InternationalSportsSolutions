<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\BranchResource\Pages;
use App\Filament\Academy\Resources\BranchResource\RelationManagers;
use App\Models\Branch;
use App\Models\User;
use App\Models\Academy;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;
use Filament\Tables\Filters\SelectFilter;
use Filament\Support\Enums\FontWeight;

class BranchResource extends BaseAcademyResource
{
    protected static ?string $model = Branch::class;

    protected static ?string $navigationIcon = 'heroicon-o-building-office';
    protected static ?string $navigationGroup = 'Academy Management';
    protected static ?string $navigationLabel = 'Branches';
    
    protected static ?string $modelLabel = 'Branch';
    
    protected static ?string $pluralModelLabel = 'Branches';
    
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Branch Limit Information')
                    ->description(function () {
                        $academy = \App\Models\Academy::find(Auth::user()->academy_id);
                        $currentCount = \App\Models\Branch::where('academy_id', Auth::user()->academy_id)
                            ->where('status', 'active')
                            ->count();
                        $maxBranches = $academy?->max_branches ?? 'Unlimited';
                        
                        return "Active branches: {$currentCount} / {$maxBranches}";
                    })
                    ->schema([
                        Forms\Components\Placeholder::make('branch_info')
                            ->hiddenLabel()
                            ->content(function () {
                                $academy = \App\Models\Academy::find(Auth::user()->academy_id);
                                $currentCount = \App\Models\Branch::where('academy_id', Auth::user()->academy_id)
                                    ->where('status', 'active')
                                    ->count();
                                $maxBranches = $academy?->max_branches;
                                
                                if ($maxBranches && $currentCount >= $maxBranches) {
                                    return "⚠️ **Active branch limit reached!** Your academy is limited to {$maxBranches} active branch(es). Contact support to upgrade your plan.";
                                } elseif ($maxBranches) {
                                    $remaining = $maxBranches - $currentCount;
                                    return "✅ You can create {$remaining} more active branch(es).";
                                } else {
                                    return "✅ No branch limit set for your academy.";
                                }
                            })
                            ->columnSpanFull(),
                    ])
                    ->collapsible()
                    ->collapsed(false)
                    ->visible(fn () => Auth::user()->role === 'academy_admin' || Auth::user()->is_super_admin),
                
                Section::make('Basic Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('name')
                                    ->required()
                                    ->maxLength(255)
                                    ->columnSpan(1),
                                
                                Forms\Components\TextInput::make('code')
                                    ->required()
                                    ->unique(ignoreRecord: true)
                                    ->maxLength(255)
                                    ->helperText('Unique branch identifier (e.g., BR001)')
                                    ->columnSpan(1),
                            ]),
                        
                        Forms\Components\Textarea::make('description')
                            ->rows(3)
                            ->columnSpanFull(),
                    ]),
                
                Section::make('Location Details')
                    ->schema([
                        Forms\Components\Textarea::make('address')
                            ->required()
                            ->rows(2)
                            ->columnSpanFull(),
                        
                        Grid::make(3)
                            ->schema([
                                Forms\Components\TextInput::make('city')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('state')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('postal_code')
                                    ->required()
                                    ->maxLength(10),
                            ]),
                        
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('latitude')
                                    ->numeric()
                                    ->step(0.00000001)
                                    ->helperText('GPS coordinates for mapping'),
                                
                                Forms\Components\TextInput::make('longitude')
                                    ->numeric()
                                    ->step(0.00000001),
                            ]),
                    ]),
                
                Section::make('Contact Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('phone')
                                    ->tel()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('email')
                                    ->email()
                                    ->maxLength(255),
                            ]),
                    ]),
                
                Section::make('Management & Settings')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\Select::make('manager_id')
                                    ->label('Branch Manager')
                                    ->options(function () {
                                        return User::where('academy_id', Auth::user()->academy_id)
                                            ->where('status', 'active')
                                            ->pluck('name', 'id');
                                    })
                                    ->searchable()
                                    ->placeholder('Select a manager')
                                    ->helperText('Only users from your academy are shown'),
                                
                                Forms\Components\Select::make('status')
                                    ->options([
                                        'active' => 'Active',
                                        'inactive' => 'Inactive',
                                    ])
                                    ->default('active')
                                    ->required(),
                            ]),
                        
                        Forms\Components\KeyValue::make('facilities')
                            ->label('Facilities & Equipment')
                            ->keyLabel('Facility')
                            ->valueLabel('Details')
                            ->helperText('Add facilities like parking, changing rooms, equipment, etc.')
                            ->columnSpanFull(),
                    ]),
                
                // Hidden field for academy_id
                Forms\Components\Hidden::make('academy_id')
                    ->default(fn () => Auth::user()->academy_id),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->heading(fn () => 'Total Branches: ' . \App\Models\Branch::where('academy_id', \Illuminate\Support\Facades\Auth::user()->academy_id)->count())
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::Bold),
                
                Tables\Columns\TextColumn::make('code')
                    ->searchable()
                    ->badge()
                    ->color('gray'),
                
                Tables\Columns\TextColumn::make('city')
                    ->searchable()
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('state')
                    ->searchable()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('manager.name')
                    ->label('Manager')
                    ->sortable()
                    ->placeholder('No manager assigned'),
                
                Tables\Columns\TextColumn::make('phone')
                    ->searchable()
                    ->toggleable()
                    ->icon('heroicon-m-phone'),
                
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'inactive' => 'gray',
                    })
                    ->sortable(),
                
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
                
                SelectFilter::make('manager_id')
                    ->label('Manager')
                    ->options(function () {
                        return User::where('academy_id', Auth::user()->academy_id)
                            ->where('status', 'active')
                            ->pluck('name', 'id');
                    })
                    ->searchable(),
                
                SelectFilter::make('city')
                    ->options(function () {
                        return Branch::forAcademy(Auth::user()->academy_id)
                            ->distinct()
                            ->pluck('city', 'city')
                            ->toArray();
                    }),
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
                        ->label('Activate Branches')
                        ->icon('heroicon-o-check-circle')
                        ->color('success')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['status' => 'active']);
                            });
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\BulkAction::make('deactivate')
                        ->label('Deactivate Branches')
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
            ->headerActions([
                Tables\Actions\Action::make('print')
                    ->label('Print Branches')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => route('academy.branches.print'))
                    ->openUrlInNewTab()
                    ->visible(fn () => Auth::user()->is_super_admin || static::canAcademy('print')),
            ])
            ->defaultSort('created_at', 'desc');
    }

    // Scope to current academy
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->forAcademy(Auth::user()->academy_id);
    }

    // Permission logic now handled by BaseAcademyResource

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBranches::route('/'),
            'create' => Pages\CreateBranch::route('/create'),
            'edit' => Pages\EditBranch::route('/{record}/edit'),
        ];
    }
    
    // Permission logic now handled by BaseAcademyResource
}
