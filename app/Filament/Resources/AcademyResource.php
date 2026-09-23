<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AcademyResource\Pages;
use App\Filament\Resources\AcademyResource\RelationManagers;
use App\Models\Academy;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;
use Filament\Tables\Filters\SelectFilter;
use Filament\Support\Enums\FontWeight;
use Filament\Infolists\Infolist;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\Section as InfoSection;
use Illuminate\Support\Str;
use Filament\Notifications\Notification;

class AcademyResource extends Resource
{
    protected static ?string $model = Academy::class;

    protected static ?string $navigationIcon = 'heroicon-o-building-office-2';
    
    protected static ?string $navigationLabel = 'Academies';
    
    protected static ?string $modelLabel = 'Academy';
    
    protected static ?string $pluralModelLabel = 'Academies';
    
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Basic Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('name')
                                    ->required()
                                    ->maxLength(255)
                                    ->live(onBlur: true)
                                    ->afterStateUpdated(function (string $context, $state, Forms\Set $set) {
                                        if ($context === 'create') {
                                            $set('slug', Str::slug($state));
                                        }
                                    }),
                                
                                Forms\Components\TextInput::make('slug')
                                    ->required()
                                    ->maxLength(255)
                                    ->unique(Academy::class, 'slug', ignoreRecord: true)
                                    ->rules(['alpha_dash'])
                                    ->helperText('Used for subdomain: {slug}.yourdomain.com'),
                            ]),
                        
                        Forms\Components\Textarea::make('description')
                            ->rows(3)
                            ->columnSpanFull(),
                        
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('domain')
                                    ->unique(Academy::class, 'domain', ignoreRecord: true)
                                    ->helperText('Custom domain (optional)')
                                    ->suffixIcon('heroicon-m-globe-alt'),
                                
                                Forms\Components\Select::make('status')
                                    ->options([
                                        'active' => 'Active',
                                        'inactive' => 'Inactive',
                                        'suspended' => 'Suspended',
                                    ])
                                    ->default('active')
                                    ->required(),
                            ]),
                    ]),

                Section::make('Contact Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('contact_email')
                                    ->email()
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('contact_phone')
                                    ->tel()
                                    ->maxLength(255),
                            ]),
                        
                        Forms\Components\Textarea::make('address')
                            ->rows(2)
                            ->columnSpanFull(),
                        
                        Grid::make(4)
                            ->schema([
                                Forms\Components\TextInput::make('city')
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('state')
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('country')
                                    ->maxLength(255)
                                    ->default('India'),
                                
                                Forms\Components\TextInput::make('postal_code')
                                    ->maxLength(255),
                            ]),
                    ]),

                Section::make('Subscription Limits')
                    ->schema([
                        Grid::make(4)
                            ->schema([
                                Forms\Components\TextInput::make('max_users')
                                    ->numeric()
                                    ->default(50)
                                    ->required()
                                    ->minValue(1),
                                
                                Forms\Components\TextInput::make('max_students')
                                    ->numeric()
                                    ->default(200)
                                    ->required()
                                    ->minValue(1),
                                
                                Forms\Components\TextInput::make('max_branches')
                                    ->numeric()
                                    ->default(5)
                                    ->required()
                                    ->minValue(1),
                                
                                Forms\Components\TextInput::make('max_coaches')
                                    ->numeric()
                                    ->default(20)
                                    ->required()
                                    ->minValue(1),
                            ]),
                        
                        Grid::make(2)
                            ->schema([
                                Forms\Components\DatePicker::make('subscription_starts_at')
                                    ->default(now()),
                                
                                Forms\Components\DatePicker::make('subscription_ends_at'),
                            ]),
                    ]),

                Section::make('Media & Settings')
                    ->schema([
                        Forms\Components\FileUpload::make('logo')
                            ->image()
                            ->directory('academy-logos')
                            ->visibility('public'),
                        
                        Forms\Components\KeyValue::make('settings')
                            ->keyLabel('Setting Name')
                            ->valueLabel('Setting Value')
                            ->addActionLabel('Add Setting')
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('logo')
                    ->circular()
                    ->size(40),
                
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::Bold),
                
                Tables\Columns\TextColumn::make('slug')
                    ->searchable()
                    ->badge()
                    ->color('gray'),
                
                Tables\Columns\TextColumn::make('contact_email')
                    ->searchable()
                    ->icon('heroicon-m-envelope')
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('contact_phone')
                    ->searchable()
                    ->icon('heroicon-m-phone')
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('city')
                    ->searchable()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'inactive' => 'gray',
                        'suspended' => 'danger',
                    }),
                
                Tables\Columns\TextColumn::make('max_students')
                    ->label('Student Limit')
                    ->numeric()
                    ->sortable()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('subscription_ends_at')
                    ->label('Subscription Ends')
                    ->date()
                    ->sortable()
                    ->color(fn ($state) => $state && $state->isPast() ? 'danger' : 'success')
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'active' => 'Active',
                        'inactive' => 'Inactive',
                        'suspended' => 'Suspended',
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        return $data['value'] 
                            ? $query->where('status', $data['value'])
                            : $query;
                    }),
                
                SelectFilter::make('city')
                    ->options(function () {
                        return Academy::query()
                            ->pluck('city')
                            ->filter()
                            ->unique()
                            ->sort()
                            ->mapWithKeys(function ($city) {
                                return [$city => $city];
                            })
                            ->toArray();
                    })
                    ->query(function (Builder $query, array $data): Builder {
                        return $data['value'] 
                            ? $query->where('city', $data['value'])
                            : $query;
                    }),
                
                Tables\Filters\Filter::make('subscription_expired')
                    ->query(fn (Builder $query): Builder => 
                        $query->whereDate('subscription_ends_at', '<', now()->toDateString())
                    )
                    ->label('Expired Subscriptions'),
            ])
            ->actions([
                Tables\Actions\Action::make('purge_tenant_data')
                    ->label('Purge Testing Data')
                    ->icon('heroicon-o-trash')
                    ->color('danger')
                    ->modalHeading(fn (Academy $record) => "Purge Testing Data for {$record->name}")
                    ->modalDescription('WARNING: This action will permanently delete all testing data (Students, Attendances, Payroll, Fees, Batches, Events, Coaches, Branches, Non-Admin Users) for this academy. This cannot be undone.')
                    ->form([
                        Forms\Components\Checkbox::make('confirm_purge')
                            ->label('I confirm I want to permanently delete all testing data for this academy')
                            ->required(),
                        Forms\Components\Toggle::make('preserve_admin_user')
                            ->label('Preserve Primary Academy Admin Account')
                            ->default(true)
                            ->helperText('Retains the primary Academy Admin user so they can log into a clean production environment.'),
                    ])
                    ->action(function (Academy $record, array $data) {
                        $counts = $record->purgeTenantData($data['preserve_admin_user'] ?? true);
                        $totalDeleted = array_sum($counts);

                        Notification::make()
                            ->title('Tenant Testing Data Truncated')
                            ->body("Successfully purged {$totalDeleted} testing records for {$record->name}. Ready for production handover!")
                            ->success()
                            ->send();
                    }),
                Tables\Actions\Action::make('details')
                    ->label('Details')
                    ->icon('heroicon-o-eye')
                    ->url(fn ($record) => static::getUrl('view', ['record' => $record]))
                    ->openUrlInNewTab(false),
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    Tables\Actions\BulkAction::make('activate')
                        ->label('Activate Selected')
                        ->icon('heroicon-o-check-circle')
                        ->color('success')
                        ->action(function ($records) {
                            $records->each->update(['status' => 'active']);
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\BulkAction::make('suspend')
                        ->label('Suspend Selected')
                        ->icon('heroicon-o-x-circle')
                        ->color('danger')
                        ->action(function ($records) {
                            $records->each->update(['status' => 'suspended']);
                        })
                        ->requiresConfirmation(),
                ]),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function getRelations(): array
    {
        return [
            // RelationManagers\UsersRelationManager::class, // We'll create this later
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAcademies::route('/'),
            'create' => Pages\CreateAcademy::route('/create'),
            'view' => Pages\ViewAcademy::route('/{record}'),
            'edit' => Pages\EditAcademy::route('/{record}/edit'),
        ];
    }
    
    protected static ?int $academyCountCache = null;

    protected static function academyCount(): int
    {
        if (static::$academyCountCache === null) {
            static::$academyCountCache = static::getModel()::count();
        }
        return static::$academyCountCache;
    }

    public static function getNavigationBadge(): ?string
    {
        return static::academyCount();
    }
    
    public static function getNavigationBadgeColor(): string|array|null
    {
        return static::academyCount() > 10 ? 'warning' : 'primary';
    }
}
