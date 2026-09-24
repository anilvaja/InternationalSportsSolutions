<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\AcademyRoleResource\Pages;
use App\Models\AcademyRole;
use App\Models\AcademyPermission;
use App\Rules\UniqueAcademyRoleName;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;

class AcademyRoleResource extends BaseAcademyResource
{
    protected static ?string $model = AcademyRole::class;

    protected static ?string $navigationIcon = 'heroicon-o-key';
    
    protected static ?string $navigationLabel = 'Roles';
    
    protected static ?string $modelLabel = 'Role';
    
    protected static ?string $pluralModelLabel = 'Roles';
    
    protected static ?string $navigationGroup = 'ADMINISTRATION';
    
    protected static ?int $navigationSort = 1;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();
        
        return parent::getEloquentQuery()
            ->where('academy_id', $user->academy_id);
    }

    public static function form(Form $form): Form
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return $form
            ->schema([
                Section::make('Basic Information')
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->required()
                            ->maxLength(255)
                            ->disabled(fn ($record) => $record?->is_default ?? false)
                            ->helperText(fn ($record) => $record?->is_default ? 'System role name cannot be changed' : 'Role identifier (e.g., admin, manager, coach, staff)'),
                            
                        Forms\Components\TextInput::make('display_name')
                            ->required()
                            ->maxLength(255)
                            ->helperText('Human readable role name'),
                        
                        Forms\Components\Textarea::make('description')
                            ->maxLength(500)
                            ->helperText('Brief description of this role'),
                            
                        Forms\Components\Toggle::make('is_active')
                            ->default(true)
                            ->helperText('Only active roles can be assigned to users'),
                    ]),

                Forms\Components\Section::make('Permissions')
                    ->schema([
                        Forms\Components\CheckboxList::make('permissions')
                            ->label('Role Permissions')
                            ->options(function () {
                                $permissions = AcademyPermission::getGroupedPermissions();
                                $options = [];
                                
                                foreach ($permissions as $category => $categoryPermissions) {
                                    $categoryLabel = ucwords(str_replace('_', ' ', $category));
                                    foreach ($categoryPermissions as $permission) {
                                        $options[$permission->name] = $categoryLabel . ': ' . $permission->display_name;
                                    }
                                }
                                
                                return $options;
                            })
                            ->searchable()
                            ->bulkToggleable()
                            ->gridDirection('row')
                            ->columns(2)
                            ->helperText('Select permissions for this role'),
                    ])
                    ->collapsible()
                    ->collapsed(false),
                    
                Forms\Components\Hidden::make('academy_id')
                    ->default($academyId),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                    
                Tables\Columns\TextColumn::make('display_name')
                    ->searchable()
                    ->sortable(),
                    
                Tables\Columns\TextColumn::make('description')
                    ->limit(50)
                    ->tooltip(function (Tables\Columns\TextColumn $column): ?string {
                        $state = $column->getState();
                        if (strlen($state) <= 50) {
                            return null;
                        }
                        return $state;
                    }),
                    
                Tables\Columns\TextColumn::make('users_count')
                    ->label('Users')
                    ->getStateUsing(function ($record) {
                        return $record->users()->count();
                    })
                    ->badge(),

                Tables\Columns\TextColumn::make('permissions_count')
                    ->label('Permissions')
                    ->getStateUsing(function ($record) {
                        $permissions = $record->permissions;
                        
                        if (empty($permissions) || !is_array($permissions)) {
                            return 0;
                        }
                        
                        return count($permissions);
                    })
                    ->formatStateUsing(function ($state) {
                        return $state . ' permission' . ($state !== 1 ? 's' : '');
                    })
                    ->badge()
                    ->color(function ($state) {
                        return $state > 0 ? 'success' : 'gray';
                    }),
                    
                Tables\Columns\IconColumn::make('is_active')
                    ->boolean(),
                    
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active')
                    ->label('Active')
                    ->boolean()
                    ->trueLabel('Active roles only')
                    ->falseLabel('Inactive roles only')
                    ->native(false),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make()
                    ->before(function (AcademyRole $record) {
                        // Remove all user assignments before deleting role
                        $record->userAcademyRoles()->delete();
                    }),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make()
                        ->before(function ($records) {
                            // Remove all user assignments for bulk deleted roles
                            $roleIds = $records->pluck('id');
                            \App\Models\UserAcademyRole::whereIn('academy_role_id', $roleIds)->delete();
                        }),
                ]),
            ])
            ->headerActions([
                Tables\Actions\Action::make('print')
                    ->label('Print Roles')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => route('academy.roles.print'))
                    ->openUrlInNewTab()
                    ->visible(fn () => Auth::user()->is_super_admin || !is_null(Auth::user()->academy_id)),
            ])
            ->defaultSort('created_at', 'desc');
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
            'index' => Pages\ListAcademyRoles::route('/'),
            'create' => Pages\CreateAcademyRole::route('/create'),
            'edit' => Pages\EditAcademyRole::route('/{record}/edit'),
        ];
    }
    
    /**
     * Allow editing but with restrictions for default roles
     */
    public static function canEdit($record): bool
    {
        // First check base permissions
        if (!parent::canEdit($record)) {
            return false;
        }
        
        // Allow editing even for default roles (just restrict certain fields in form)
        return true;
    }
    
    /**
     * Prevent deleting default roles
     */
    public static function canDelete($record): bool
    {
        // First check base permissions
        if (!parent::canDelete($record)) {
            return false;
        }
        
        // Prevent deleting default/non-removable roles
        if ($record && ($record->is_default || !$record->is_removable)) {
            return false;
        }
        
        return true;
    }


    /**
     * Override the permission name generation to match our database permissions
     */
    public static function getAcademyPermissionName(string $action): string
    {
        return $action . '_academy_roles';
    }
}
