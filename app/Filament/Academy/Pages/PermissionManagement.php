<?php

namespace App\Filament\Academy\Pages;

use App\Models\AcademyPermission;
use App\Models\AcademyRole;
use App\Models\AcademyPermissionTemplate;
use Filament\Pages\Page;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables;
use Filament\Forms;
use Filament\Actions\Action;
use Filament\Support\Enums\MaxWidth;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;

class PermissionManagement extends Page implements HasForms, HasTable
{
    use InteractsWithForms, InteractsWithTable;

    protected static ?string $navigationIcon = 'heroicon-o-shield-check';
    
    protected static ?string $navigationLabel = 'Permission Management';
    
    protected static ?string $title = 'Permission Management';
    
    protected static string $view = 'filament.academy.pages.permission-management';
    
    protected static ?string $navigationGroup = 'Access Management';
    
    protected static ?int $navigationSort = 15;

    public $selectedRole = null;
    public $permissionMatrix = [];

    public static function canAccess(): bool
    {
        $user = Auth::user();
        
        if (!$user) {
            return false;
        }
        
        if ($user->is_super_admin) {
            return true;
        }
        
        return $user->hasPermission('manage_permissions');
    }

    public function mount(): void
    {
        $this->loadPermissionMatrix();
    }

    protected function loadPermissionMatrix(): void
    {
        $roles = AcademyRole::where('academy_id', Auth::user()->academy_id)
            ->where('is_active', true)
            ->get();

        $permissions = AcademyPermission::getGroupedPermissions();

        $matrix = [];
        foreach ($permissions as $category => $categoryPermissions) {
            $matrix[$category] = [];
            foreach ($categoryPermissions as $permission) {
                $matrix[$category][$permission->name] = [
                    'display_name' => $permission->display_name,
                    'description' => $permission->description,
                    'roles' => []
                ];
                
                foreach ($roles as $role) {
                    $rolePermissions = $role->permissions;
                    // Ensure permissions is always an array
                    if (!is_array($rolePermissions)) {
                        $rolePermissions = [];
                    }
                    $hasPermission = in_array($permission->name, $rolePermissions);
                    $matrix[$category][$permission->name]['roles'][$role->id] = [
                        'name' => $role->display_name,
                        'has_permission' => $hasPermission
                    ];
                }
            }
        }

        $this->permissionMatrix = $matrix;
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('refreshMatrix')
                ->label('Refresh')
                ->icon('heroicon-o-arrow-path')
                ->action(fn () => $this->loadPermissionMatrix()),
                
            Action::make('bulkAssign')
                ->label('Bulk Assign Permissions')
                ->icon('heroicon-o-plus-circle')
                ->color('success')
                ->form([
                    Forms\Components\Select::make('role_id')
                        ->label('Select Role')
                        ->options(
                            AcademyRole::where('academy_id', Auth::user()->academy_id)
                                ->where('is_active', true)
                                ->pluck('display_name', 'id')
                        )
                        ->required(),
                    
                    Forms\Components\Section::make('Choose Assignment Method')
                        ->description('You can either select permissions manually or use a template')
                        ->schema([
                            Forms\Components\Radio::make('assignment_method')
                                ->label('Assignment Method')
                                ->options([
                                    'manual' => 'Select permissions manually',
                                    'template' => 'Use permission template',
                                ])
                                ->default('manual')
                                ->live()
                                ->required(),
                            
                            Forms\Components\Select::make('template_id')
                                ->label('Permission Template')
                                ->options(function () {
                                    return AcademyPermissionTemplate::forAcademy(Auth::user()->academy_id)
                                        ->orderBy('name')
                                        ->get()
                                        ->mapWithKeys(function ($template) {
                                            $type = $template->is_system_template ? ' (System)' : '';
                                            return [$template->id => $template->name . $type . ' - ' . $template->permission_count . ' permissions'];
                                        });
                                })
                                ->visible(fn ($get) => $get('assignment_method') === 'template')
                                ->required(fn ($get) => $get('assignment_method') === 'template')
                                ->searchable()
                                ->helperText('Select a template to apply all its permissions'),
                            
                            Forms\Components\CheckboxList::make('permissions')
                                ->label('Permissions to Assign')
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
                                ->visible(fn ($get) => $get('assignment_method') === 'manual')
                                ->required(fn ($get) => $get('assignment_method') === 'manual')
                                ->searchable()
                                ->bulkToggleable()
                                ->gridDirection('row')
                                ->columns(2),
                        ]),
                ])
                ->action(function (array $data) {
                    $role = AcademyRole::find($data['role_id']);
                    $currentPermissions = $role->permissions;
                    
                    // Ensure permissions is always an array
                    if (!is_array($currentPermissions)) {
                        $currentPermissions = [];
                    }
                    
                    if ($data['assignment_method'] === 'template') {
                        $template = AcademyPermissionTemplate::find($data['template_id']);
                        $templatePermissions = $template->permissions;
                        if (!is_array($templatePermissions)) {
                            $templatePermissions = [];
                        }
                        $newPermissions = array_unique(array_merge($currentPermissions, $templatePermissions));
                        $source = "template '{$template->name}'";
                        $count = count($templatePermissions);
                    } else {
                        $manualPermissions = $data['permissions'] ?? [];
                        $newPermissions = array_unique(array_merge($currentPermissions, $manualPermissions));
                        $source = 'manual selection';
                        $count = count($manualPermissions);
                    }
                    
                    $role->update(['permissions' => array_values($newPermissions)]);
                    
                    $this->loadPermissionMatrix();
                    
                    Notification::make()
                        ->title('Permissions assigned successfully')
                        ->body("Applied {$count} permissions from {$source} to role '{$role->display_name}'")
                        ->success()
                        ->send();
                })
                ->modalWidth(MaxWidth::FourExtraLarge),
                
            Action::make('createPermissionTemplate')
                ->label('Create Permission Template')
                ->icon('heroicon-o-document-plus')
                ->color('info')
                ->form([
                    Forms\Components\TextInput::make('template_name')
                        ->label('Template Name')
                        ->required()
                        ->placeholder('e.g., Manager Template, Coach Template'),
                    
                    Forms\Components\Textarea::make('template_description')
                        ->label('Description')
                        ->placeholder('Describe what this template is for'),
                        
                    Forms\Components\CheckboxList::make('template_permissions')
                        ->label('Permissions in Template')
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
                        ->required(),
                ])
                ->action(function (array $data) {
                    // Create the template in database
                    AcademyPermissionTemplate::create([
                        'academy_id' => Auth::user()->academy_id,
                        'name' => $data['template_name'],
                        'description' => $data['template_description'],
                        'permissions' => $data['template_permissions'],
                        'is_system_template' => false,
                    ]);
                    
                    Notification::make()
                        ->title('Permission template created successfully')
                        ->body("Template '{$data['template_name']}' has been created with " . count($data['template_permissions']) . " permissions.")
                        ->success()
                        ->send();
                })
                ->modalWidth(MaxWidth::FourExtraLarge),
                
            Action::make('manageTemplates')
                ->label('Manage Templates')
                ->icon('heroicon-o-document-text')
                ->color('warning')
                ->form([
                    Forms\Components\Section::make('Permission Templates')
                        ->description('View and manage your permission templates')
                        ->schema([
                            Forms\Components\Grid::make(1)
                                ->schema([
                                    Forms\Components\Placeholder::make('templates_list')
                                        ->label('')
                                        ->content(function () {
                                            $templates = AcademyPermissionTemplate::forAcademy(Auth::user()->academy_id)
                                                ->orderBy('name')
                                                ->get();
                                                
                                            if ($templates->isEmpty()) {
                                                return 'No templates created yet.';
                                            }
                                            
                                            $content = '';
                                            foreach ($templates as $template) {
                                                $type = $template->is_system_template ? 'System' : 'Custom';
                                                $content .= "📋 **{$template->name}** ({$type})\n";
                                                $content .= "   {$template->description}\n";
                                                $content .= "   Permissions: {$template->permission_count}\n\n";
                                            }
                                            
                                            return $content;
                                        }),
                                ])
                        ])
                ])
                ->action(function () {
                    // Just viewing templates
                })
                ->modalSubmitAction(false)
                ->modalCancelActionLabel('Close')
                ->modalWidth(MaxWidth::TwoExtraLarge),
                
            Action::make('applyTemplate')
                ->label('Apply Template')
                ->icon('heroicon-o-document-check')
                ->color('success')
                ->form([
                    Forms\Components\Select::make('template_id')
                        ->label('Select Template')
                        ->options(function () {
                            return AcademyPermissionTemplate::forAcademy(Auth::user()->academy_id)
                                ->orderBy('name')
                                ->get()
                                ->mapWithKeys(function ($template) {
                                    $type = $template->is_system_template ? ' (System)' : '';
                                    return [$template->id => $template->name . $type . ' - ' . $template->permission_count . ' permissions'];
                                });
                        })
                        ->required()
                        ->searchable()
                        ->helperText('Choose a template to apply to a role'),
                    
                    Forms\Components\Select::make('role_id')
                        ->label('Apply to Role')
                        ->options(
                            AcademyRole::where('academy_id', Auth::user()->academy_id)
                                ->where('is_active', true)
                                ->pluck('display_name', 'id')
                        )
                        ->required()
                        ->helperText('Select which role should receive these permissions'),
                        
                    Forms\Components\Radio::make('apply_mode')
                        ->label('Application Mode')
                        ->options([
                            'replace' => 'Replace all permissions (overwrites existing)',
                            'merge' => 'Add to existing permissions (merge)',
                        ])
                        ->default('merge')
                        ->required()
                        ->helperText('Choose how to apply the template permissions'),
                ])
                ->action(function (array $data) {
                    $template = AcademyPermissionTemplate::find($data['template_id']);
                    $role = AcademyRole::find($data['role_id']);
                    
                    $templatePermissions = $template->permissions;
                    if (!is_array($templatePermissions)) {
                        $templatePermissions = [];
                    }
                    
                    if ($data['apply_mode'] === 'replace') {
                        $newPermissions = $templatePermissions;
                    } else {
                        $currentPermissions = $role->permissions;
                        if (!is_array($currentPermissions)) {
                            $currentPermissions = [];
                        }
                        $newPermissions = array_unique(array_merge($currentPermissions, $templatePermissions));
                    }
                    
                    $role->update(['permissions' => array_values($newPermissions)]);
                    $this->loadPermissionMatrix();
                    
                    $mode = $data['apply_mode'] === 'replace' ? 'replaced with' : 'merged with';
                    
                    Notification::make()
                        ->title('Template applied successfully')
                        ->body("Role '{$role->display_name}' permissions have been {$mode} template '{$template->name}'")
                        ->success()
                        ->send();
                })
                ->modalWidth(MaxWidth::TwoExtraLarge),
        ];
    }

    public function togglePermission(string $roleId, string $permission): void
    {
        $role = AcademyRole::find($roleId);
        $currentPermissions = $role->permissions;
        
        // Ensure permissions is always an array
        if (!is_array($currentPermissions)) {
            $currentPermissions = [];
        }
        
        if (in_array($permission, $currentPermissions)) {
            // Remove permission
            $newPermissions = array_filter($currentPermissions, fn($p) => $p !== $permission);
        } else {
            // Add permission
            $newPermissions = array_merge($currentPermissions, [$permission]);
        }
        
        $role->update(['permissions' => array_values($newPermissions)]);
        $this->loadPermissionMatrix();
        
        $action = in_array($permission, $currentPermissions) ? 'removed from' : 'added to';
        
        Notification::make()
            ->title("Permission {$action} {$role->display_name}")
            ->success()
            ->send();
    }

    public function getTableQuery()
    {
        return AcademyRole::query()
            ->where('academy_id', Auth::user()->academy_id)
            ->where('is_active', true);
    }

    public function table(Tables\Table $table): Tables\Table
    {
        return $table
            ->query($this->getTableQuery())
            ->columns([
                Tables\Columns\TextColumn::make('display_name')
                    ->label('Role')
                    ->searchable()
                    ->sortable()
                    ->weight('semibold'),
                    
                Tables\Columns\TextColumn::make('description')
                    ->limit(40)
                    ->tooltip(function (Tables\Columns\TextColumn $column): ?string {
                        $state = $column->getState();
                        return strlen($state) > 40 ? $state : null;
                    }),
                    
                Tables\Columns\TextColumn::make('permissions_count')
                    ->label('Permissions')
                    ->getStateUsing(function ($record) {
                        $permissions = $record->permissions;
                        if (!is_array($permissions)) {
                            return 0;
                        }
                        return count($permissions);
                    })
                    ->badge()
                    ->color('success'),
                    
                Tables\Columns\TextColumn::make('users_count')
                    ->label('Users')
                    ->getStateUsing(function ($record) {
                        return $record->users()->count();
                    })
                    ->badge()
                    ->color('info'),
            ])
            ->actions([
                Tables\Actions\Action::make('quickEdit')
                    ->label('Quick Edit Permissions')
                    ->icon('heroicon-o-pencil-square')
                    ->form(function ($record) {
                        return [
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
                                ->default(function ($record) {
                                    $permissions = $record->permissions;
                                    return is_array($permissions) ? $permissions : [];
                                })
                                ->searchable()
                                ->bulkToggleable()
                                ->gridDirection('row')
                                ->columns(2),
                        ];
                    })
                    ->action(function ($record, array $data) {
                        $record->update(['permissions' => $data['permissions'] ?? []]);
                        $this->loadPermissionMatrix();
                        
                        Notification::make()
                            ->title('Permissions updated successfully')
                            ->success()
                            ->send();
                    })
                    ->modalWidth(MaxWidth::FourExtraLarge),
            ])
            ->heading('Roles Overview');
    }
}
