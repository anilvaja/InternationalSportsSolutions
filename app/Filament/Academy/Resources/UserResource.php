<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\UserResource\Pages;
use App\Models\User;
use App\Models\AcademyRole;
use App\Models\AcademyPermission;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Filament\Notifications\Notification;
use Filament\Tables\Filters\SelectFilter;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;

class UserResource extends BaseAcademyResource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';
    
    protected static ?string $navigationLabel = 'Coaches & Staff';
    
    protected static ?string $modelLabel = 'Staff User';
    
    protected static ?string $pluralModelLabel = 'Coaches & Staff';
    
    protected static ?string $navigationGroup = 'ACADEMY';
    
    protected static ?int $navigationSort = 4;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();
        
        return parent::getEloquentQuery()
            ->where('academy_id', $user->academy_id)
            ->where('is_super_admin', false)
            ->with(['academy', 'activeAcademyRoles.academyRole']);
    }

    public static function form(Form $form): Form
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return $form
            ->schema([
                Section::make(function (?User $record) {
                        $currentUser = Auth::user();
                        if ($record && $currentUser && $currentUser->id === $record->id) {
                            return 'Personal Profile';
                        }
                        return 'User Information';
                    })
                    ->description(function (?User $record) {
                        $currentUser = Auth::user();
                        if ($record && $currentUser && $currentUser->id === $record->id) {
                            return 'Update your personal information and password. Contact an administrator to change your status.';
                        }
                        return null;
                    })
                    ->schema([
                        Grid::make(2)->schema([
                            Forms\Components\TextInput::make('name')
                                ->required()
                                ->maxLength(255),
                                
                            Forms\Components\TextInput::make('email')
                                ->email()
                                ->required()
                                ->unique(User::class, 'email', ignoreRecord: true)
                                ->maxLength(255),
                        ]),
                        
                        Grid::make(2)->schema([
                            Forms\Components\TextInput::make('phone')
                                ->tel()
                                ->maxLength(20),
                                
                            Forms\Components\Select::make('status')
                                ->options([
                                    'active' => 'Active',
                                    'inactive' => 'Inactive',
                                    'suspended' => 'Suspended',
                                ])
                                ->default('active')
                                ->required()
                                ->disabled(function (?User $record) {
                                    $currentUser = Auth::user();
                                    return $record && $currentUser && $currentUser->id === $record->id;
                                })
                                ->helperText(function (?User $record) {
                                    $currentUser = Auth::user();
                                    if ($record && $currentUser && $currentUser->id === $record->id) {
                                        return 'You cannot change your own status. Contact an administrator.';
                                    }
                                    return null;
                                }),
                        ]),
                        
                        Forms\Components\TextInput::make('password')
                            ->password()
                            ->dehydrateStateUsing(fn ($state) => Hash::make($state))
                            ->dehydrated(fn ($state) => filled($state))
                            ->required(fn (string $context): bool => $context === 'create')
                            ->maxLength(255)
                            ->helperText(function (?User $record) {
                                $currentUser = Auth::user();
                                if ($record && $currentUser && $currentUser->id === $record->id) {
                                    return 'Leave blank to keep current password, or enter new password to change it.';
                                }
                                return $record ? 'Leave blank to keep current password' : 'Password is required for new users';
                            }),
                    ]),
                    
                Section::make('Role Assignment')
                    ->description(function (?User $record) {
                        $currentUser = Auth::user();
                        if ($record && $currentUser && $currentUser->id === $record->id) {
                            return 'View your current role and permissions. Contact an administrator to change roles or permissions.';
                        }
                        return 'Academy roles are automatically assigned based on user role: academy_admin → admin, coach → coach, staff → staff';
                    })
                    ->schema([
                        Forms\Components\Placeholder::make('auto_role_info')
                            ->label('Automatic Role Assignment')
                            ->content('When you save this user, they will automatically be assigned the appropriate academy role based on their role field.')
                            ->extraAttributes(['class' => 'text-sm text-blue-600 bg-blue-50 p-3 rounded-lg'])
                            ->visible(function (?User $record) {
                                $currentUser = Auth::user();
                                // Only show for new users when not self-editing
                                return $record === null && (!$currentUser || $currentUser->id !== optional($record)->id);
                            }),
                            
                        Forms\Components\Placeholder::make('self_edit_warning')
                            ->label('Role & Permission Restriction')
                            ->content('You cannot modify your own roles and permissions. Please ask another administrator to make these changes.')
                            ->extraAttributes(['class' => 'text-sm text-orange-600 bg-orange-50 p-3 rounded-lg'])
                            ->visible(function (?User $record) {
                                $currentUser = Auth::user();
                                return $record && $currentUser && $currentUser->id === $record->id;
                            }),
                            
                        Forms\Components\Placeholder::make('current_roles_display')
                            ->label('Your Current Roles')
                            ->content(function (?User $record) {
                                if (!$record) return 'No roles assigned yet.';
                                
                                $roles = $record->activeAcademyRoles
                                    ? $record->activeAcademyRoles->map(function ($userRole) {
                                        return optional($userRole->academyRole)->display_name;
                                    })->filter()->unique()->values()
                                    : collect();
                                
                                return $roles->isEmpty() ? 'No roles assigned' : $roles->join(', ');
                            })
                            ->extraAttributes(['class' => 'text-sm text-blue-600 bg-blue-50 p-3 rounded-lg'])
                            ->visible(function (?User $record) {
                                $currentUser = Auth::user();
                                return $record && $currentUser && $currentUser->id === $record->id;
                            }),
                            
                        Forms\Components\Select::make('academy_role_id')
                            ->label('Academy Role')
                            ->options(function () use ($academyId) {
                                return AcademyRole::where('academy_id', $academyId)
                                    ->where('is_active', true)
                                    ->pluck('display_name', 'id');
                            })
                            ->searchable()
                            ->disabled(function (?User $record) {
                                $currentUser = Auth::user();
                                return $record && $currentUser && $currentUser->id === $record->id;
                            })
                            ->helperText('This role is automatically assigned based on the user\'s role field above'),

                        Forms\Components\CheckboxList::make('additional_permissions')
                            ->label('Additional Permissions')
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
                            ->disabled(function (?User $record) {
                                $currentUser = Auth::user();
                                return $record && $currentUser && $currentUser->id === $record->id;
                            })
                            ->helperText('Grant additional permissions beyond the assigned role'),
                    ]),

                Section::make('Salary & Compensation')
                    ->description('Configure staff remuneration model and rates for attendance-based pay')
                    ->schema([
                        Grid::make(3)->schema([
                            Forms\Components\Select::make('salary_type')
                                ->label('Salary Type')
                                ->options([
                                    'hourly' => 'Hourly Rate',
                                    'minutly' => 'Minutly Rate',
                                    'monthly' => 'Monthly Salary',
                                ])
                                ->default('monthly')
                                ->required()
                                ->reactive(),

                            Forms\Components\TextInput::make('hourly_rate')
                                ->label('Hourly Rate (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->visible(fn ($get) => $get('salary_type') === 'hourly'),

                            Forms\Components\TextInput::make('minutly_rate')
                                ->label('Minutly Rate (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->visible(fn ($get) => $get('salary_type') === 'minutly'),

                            Forms\Components\TextInput::make('monthly_salary')
                                ->label('Monthly Base Salary (₹)')
                                ->numeric()
                                ->prefix('₹')
                                ->visible(fn ($get) => $get('salary_type') === 'monthly'),
                        ]),

                        Grid::make(3)->schema([
                            Forms\Components\TextInput::make('overtime_hourly_rate')
                                ->label('Overtime Hourly Rate (₹)')
                                ->numeric()
                                ->prefix('₹'),

                            Forms\Components\TextInput::make('standard_daily_hours')
                                ->label('Standard Daily Work Hours')
                                ->numeric()
                                ->default(8.00)
                                ->suffix('hrs'),

                            Forms\Components\TextInput::make('max_daily_work_hours')
                                ->label('Max Daily Work Hours (Limit)')
                                ->numeric()
                                ->default(10.00)
                                ->suffix('hrs')
                                ->helperText('Excess daily hours require Admin Approval'),
                        ]),
                    ]),
                    
                Forms\Components\Hidden::make('academy_id')
                    ->default($academyId),
                    
                Forms\Components\Hidden::make('is_super_admin')
                    ->default(false),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->description('Academy users with automatic role assignment: academy_admin → Admin, coach → Coach, staff → Staff')
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('email')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('phone')
                    ->searchable(),
                Tables\Columns\TextColumn::make('role_names')
                    ->label('Roles')
                    ->getStateUsing(function ($record) {
                        if (method_exists($record, 'getRoleNamesAttribute')) {
                            return $record->role_names;
                        }
                        // fallback
                        $roles = $record->activeAcademyRoles
                            ? $record->activeAcademyRoles->map(function ($userRole) {
                                return optional($userRole->academyRole)->display_name;
                            })->filter()->unique()->values()
                            : collect();
                        return $roles->isEmpty() ? 'No Role' : $roles->join(', ');
                    })
                    ->badge()
                    ->color(function ($record) {
                        $roles = $record->activeAcademyRoles
                            ? $record->activeAcademyRoles->map(function ($userRole) {
                                return optional($userRole->academyRole)->display_name;
                            })->filter()->unique()->values()
                            : collect();
                        if ($roles->count() > 1) {
                            return 'info';
                        }
                        $state = $roles->first();
                        return match ($state) {
                            'Admin' => 'danger',
                            'Manager' => 'warning',
                            'Coach' => 'success',
                            'Staff' => 'info',
                            default => 'gray',
                        };
                    }),
                Tables\Columns\BadgeColumn::make('status')
                    ->colors([
                        'success' => 'active',
                        'warning' => 'inactive',
                        'danger' => 'suspended',
                    ]),
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
                        'suspended' => 'Suspended',
                    ]),
                    
                SelectFilter::make('academy_role')
                    ->relationship('activeAcademyRoles.academyRole', 'display_name')
                    ->preload(),
            ])
            ->actions([
                Tables\Actions\Action::make('manage_roles')
                    ->label('Manage Roles')
                    ->icon('heroicon-o-users')
                    ->color('primary')
                    ->form(function (User $record) {
                        $academyId = $record->academy_id;
                        $allRoles = AcademyRole::where('academy_id', $academyId)
                            ->where('is_active', true)
                            ->pluck('display_name', 'id');
                        $currentRoles = $record->activeAcademyRoles()->pluck('academy_role_id')->toArray();
                        return [
                            Forms\Components\Select::make('roles')
                                ->label('Academy Roles')
                                ->options($allRoles)
                                ->multiple()
                                ->searchable()
                                ->default($currentRoles)
                                ->helperText('Select one or more roles for this user.'),
                        ];
                    })
                    ->action(function (User $record, array $data) {
                        $academyId = $record->academy_id;
                        $selectedRoles = $data['roles'] ?? [];
                        $currentRoles = $record->activeAcademyRoles()->pluck('academy_role_id')->toArray();
                        // Remove roles not in selected
                        $rolesToRemove = array_diff($currentRoles, $selectedRoles);
                        foreach ($rolesToRemove as $roleId) {
                            $userRole = $record->userAcademyRoles()
                                ->where('academy_role_id', $roleId)
                                ->where('is_active', true)
                                ->first();
                            if ($userRole) {
                                $userRole->delete();
                            }
                        }
                        // Add new roles
                        $rolesToAdd = array_diff($selectedRoles, $currentRoles);
                        foreach ($rolesToAdd as $roleId) {
                            $role = \App\Models\AcademyRole::find($roleId);
                            if ($role) {
                                $record->userAcademyRoles()->create([
                                    'academy_id' => $role->academy_id,
                                    'academy_role_id' => $roleId,
                                    'is_active' => true,
                                    'assigned_at' => now(),
                                ]);
                            }
                        }
                        Notification::make()
                            ->title('Roles updated successfully')
                            ->success()
                            ->send();
                    })
                    ->modalSubmitActionLabel('Save')
                    ->modalCancelActionLabel('Cancel')
                    ->visible(function (User $record) {
                        $currentUser = Auth::user();
                        
                        // Prevent users from managing their own roles
                        if ($currentUser && $currentUser->id === $record->id) {
                            return false;
                        }
                        
                        return \App\Support\AcademyPermissionHelper::can('assign_roles');
                    }),
                    
                Tables\Actions\Action::make('manage_permissions')
                    ->label('Manage Permissions')
                    ->icon('heroicon-o-shield-check')
                    ->color('info')
                    ->form(function (User $record) {
                        $userRoles = $record->activeAcademyRoles()->with('academyRole')->get();
                        $assignedPermissions = [];
                        foreach ($userRoles as $userRole) {
                            $rolePermissions = $userRole->academyRole->permissions ?? [];
                            $assignedPermissions = array_merge($assignedPermissions, $rolePermissions);
                        }
                        $allPermissions = AcademyPermission::all()->groupBy('category');
                        $options = [];
                        foreach ($allPermissions as $category => $perms) {
                            $categoryLabel = ucwords(str_replace('_', ' ', $category));
                            foreach ($perms as $perm) {
                                $options[$perm->name] = $categoryLabel . ': ' . $perm->display_name;
                            }
                        }
                        $userRole = $record->activeAcademyRoles()->forAcademy($record->academy_id)->first();
                        $current = $userRole ? ($userRole->additional_permissions ?? []) : [];
                        return [
                            Forms\Components\CheckboxList::make('additional_permissions')
                                ->label('Additional Permissions')
                                ->options($options)
                                ->columns(2)
                                ->default($current)
                                ->helperText('Grant or revoke additional permissions for this user. These are in addition to role permissions.'),
                        ];
                    })
                    ->action(function (User $record, array $data) {
                        $userRole = $record->activeAcademyRoles()->forAcademy($record->academy_id)->first();
                        if ($userRole) {
                            $userRole->update(['additional_permissions' => $data['additional_permissions'] ?? []]);
                        }
                        Notification::make()
                            ->title('Permissions updated successfully')
                            ->success()
                            ->send();
                    })
                    ->modalSubmitActionLabel('Save')
                    ->modalCancelActionLabel('Cancel')
                    ->visible(function (User $record) {
                        $currentUser = Auth::user();
                        
                        // Prevent users from managing their own permissions
                        if ($currentUser && $currentUser->id === $record->id) {
                            return false;
                        }
                        
                        return \App\Support\AcademyPermissionHelper::can('view_permissions');
                    }),
                    
                Tables\Actions\EditAction::make()
                    ->visible(function (User $record) {
                        $currentUser = Auth::user();
                        
                        // Allow users to edit their own profile or if they have edit_users permission
                        if ($currentUser && $currentUser->id === $record->id) {
                            return true; // Allow self-editing
                        }
                        
                        return \App\Support\AcademyPermissionHelper::canForUser($currentUser, 'edit_users');
                    }),
                Tables\Actions\DeleteAction::make()
                    ->before(function (User $record) {
                        // Remove all academy roles when deleting user
                        $record->userAcademyRoles()->delete();
                    })
                    ->visible(function (User $record) {
                        $currentUser = Auth::user();
                        
                        // Prevent users from deleting their own user record
                        if ($currentUser && $currentUser->id === $record->id) {
                            return false;
                        }
                        
                        return \App\Support\AcademyPermissionHelper::canForUser($currentUser, 'delete_users');
                    }),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make()
                        ->before(function ($records) {
                            // Remove all academy roles for bulk deleted users
                            $userIds = $records->pluck('id');
                            \App\Models\UserAcademyRole::whereIn('user_id', $userIds)->delete();
                        }),
                ]),
            ])
            ->headerActions([
                Tables\Actions\Action::make('print')
                    ->label('Print Users')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => route('academy.users.print'))
                    ->openUrlInNewTab()
                    ->visible(fn () => Auth::user()->is_super_admin || static::canAcademy('print')),
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
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }

    /**
     * Override the permission name generation to match our database permissions
     */
    public static function getAcademyPermissionName(string $action): string
    {
        return $action . '_users';
    }
}
