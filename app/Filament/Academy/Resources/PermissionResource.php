<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\PermissionResource\Pages;
use App\Models\AcademyPermission;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Support\Enums\FontWeight;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

class PermissionResource extends BaseAcademyResource
{
    protected static ?string $model = AcademyPermission::class;

    protected static ?string $navigationIcon = 'heroicon-o-key';

    protected static ?string $navigationLabel = 'Permissions';

    protected static ?string $modelLabel = 'Permission';

    protected static ?string $pluralModelLabel = 'Permissions';

    protected static ?string $navigationGroup = 'Access Management';

    protected static ?int $navigationSort = 2;

    public static function canAccess(): bool
    {
        $user = Auth::user();
        
        if (!$user) {
            return false;
        }
        
        // Allow super admin to access
        if ($user->is_super_admin) {
            return true;
        }
        
        // Allow all academy users to access (permissions are read-only for most users)
        return !is_null($user->academy_id);
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Permission Details')
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->required()
                            ->unique(AcademyPermission::class, 'name', ignoreRecord: true)
                            ->maxLength(255)
                            ->placeholder('e.g., view_students')
                            ->helperText('Use snake_case format'),

                        Forms\Components\TextInput::make('display_name')
                            ->required()
                            ->maxLength(255)
                            ->placeholder('e.g., View Students'),

                        Forms\Components\Select::make('category')
                            ->required()
                            ->options([
                                'users' => 'Users',
                                'roles' => 'Roles',
                                'permissions' => 'Permissions',
                                'branches' => 'Branches',
                                'batches' => 'Batches',
                                'students' => 'Students',
                                'attendance' => 'Attendance',
                                'syllabus' => 'Syllabus',
                                'coaches' => 'Coaches',
                                'payments' => 'Payments',
                                'reports' => 'Reports',
                                'academy_settings' => 'Academy Settings',
                                'notifications' => 'Notifications',
                            ])
                            ->searchable(),

                        Forms\Components\Textarea::make('description')
                            ->maxLength(500)
                            ->rows(3)
                            ->placeholder('Brief description of what this permission allows'),
                    ])
                    ->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('display_name')
                    ->label('Permission')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::SemiBold),

                Tables\Columns\TextColumn::make('name')
                    ->label('System Name')
                    ->searchable()
                    ->sortable()
                    ->fontFamily('mono')
                    ->color('gray'),

                Tables\Columns\TextColumn::make('category')
                    ->label('Category')
                    ->searchable()
                    ->sortable()
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'users' => 'primary',
                        'roles' => 'success',
                        'permissions' => 'warning',
                        'branches' => 'info',
                        'batches' => 'secondary',
                        'students' => 'primary',
                        'attendance' => 'success',
                        'syllabus' => 'warning',
                        'coaches' => 'info',
                        'payments' => 'danger',
                        'reports' => 'secondary',
                        'academy_settings' => 'primary',
                        'notifications' => 'success',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('description')
                    ->label('Description')
                    ->limit(50)
                    ->tooltip(function (Tables\Columns\TextColumn $column): ?string {
                        $state = $column->getState();
                        return strlen($state) > 50 ? $state : null;
                    }),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),

                Tables\Columns\TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('category')
                    ->options([
                        'users' => 'Users',
                        'roles' => 'Roles',
                        'permissions' => 'Permissions',
                        'branches' => 'Branches',
                        'batches' => 'Batches',
                        'students' => 'Students',
                        'attendance' => 'Attendance',
                        'syllabus' => 'Syllabus',
                        'coaches' => 'Coaches',
                        'payments' => 'Payments',
                        'reports' => 'Reports',
                        'academy_settings' => 'Academy Settings',
                        'notifications' => 'Notifications',
                    ])
                    ->multiple(),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make()
                    ->visible(fn () => \App\Support\AcademyPermissionHelper::can('edit_permissions')),
                Tables\Actions\DeleteAction::make()
                    ->visible(fn () => \App\Support\AcademyPermissionHelper::can('delete_permissions')),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make()
                        ->visible(fn () => \App\Support\AcademyPermissionHelper::can('delete_permissions')),
                ]),
            ])
            ->headerActions([
                Tables\Actions\Action::make('print')
                    ->label('Print Permissions')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => route('academy.permissions.print'))
                    ->openUrlInNewTab()
                    ->visible(fn () => \App\Support\AcademyPermissionHelper::can('print_permissions')),
                
                Tables\Actions\Action::make('seed_default')
                    ->label('Seed Default Permissions')
                    ->icon('heroicon-o-plus-circle')
                    ->color('success')
                    ->action(function () {
                        AcademyPermission::seedPermissions();
                        \Filament\Notifications\Notification::make()
                            ->title('Default permissions seeded successfully')
                            ->success()
                            ->send();
                    })
                    ->requiresConfirmation()
                    ->modalHeading('Seed Default Permissions')
                    ->modalDescription('This will create all default permissions for the system. Existing permissions will not be affected.')
                    ->modalSubmitActionLabel('Seed Permissions')
                    ->visible(fn () => \App\Support\AcademyPermissionHelper::can('manage_permissions')),
            ])
            ->defaultSort('category')
            ->defaultGroup('category')
            ->groups([
                Tables\Grouping\Group::make('category')
                    ->label('Category')
                    ->collapsible(),
            ]);
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
            'index' => Pages\ListPermissions::route('/'),
            'create' => Pages\CreatePermission::route('/create'),
            'view' => Pages\ViewPermission::route('/{record}'),
            'edit' => Pages\EditPermission::route('/{record}/edit'),
        ];
    }
}
