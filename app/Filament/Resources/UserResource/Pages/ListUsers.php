<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Models\Academy;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Filament\Forms;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Hash;

class ListUsers extends ListRecords
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()
                ->label('Create User'),
            
            Actions\Action::make('create_academy_admin')
                ->label('Create Academy Admin')
                ->icon('heroicon-o-user-plus')
                ->color('success')
                ->form([
                    Forms\Components\Select::make('academy_id')
                        ->label('Academy')
                        ->options(Academy::pluck('name', 'id'))
                        ->required()
                        ->searchable(),
                    
                    Forms\Components\TextInput::make('name')
                        ->required()
                        ->maxLength(255),
                    
                    Forms\Components\TextInput::make('email')
                        ->email()
                        ->required()
                        ->unique('users', 'email')
                        ->maxLength(255),
                    
                    Forms\Components\TextInput::make('phone')
                        ->tel(),
                    
                    Forms\Components\TextInput::make('password')
                        ->password()
                        ->required()
                        ->minLength(6)
                        ->default('password'),
                    
                    Forms\Components\Select::make('status')
                        ->options([
                            'active' => 'Active',
                            'inactive' => 'Inactive',
                        ])
                        ->default('active')
                        ->required(),
                ])
                ->action(function (array $data) {
                    User::create([
                        'name' => $data['name'],
                        'email' => $data['email'],
                        'phone' => $data['phone'] ?? null,
                        'password' => Hash::make($data['password']),
                        'academy_id' => $data['academy_id'],
                        'role' => 'academy_admin',
                        'status' => $data['status'],
                        'is_super_admin' => false,
                    ]);
                })
                ->successNotificationTitle('Academy admin created successfully'),
            
            Actions\Action::make('bulk_create_admins')
                ->label('Bulk Create Academy Admins')
                ->icon('heroicon-o-user-group')
                ->color('info')
                ->form(function () {
                    $academiesWithoutAdmins = Academy::whereDoesntHave('users', function ($query) {
                        $query->where('role', 'academy_admin');
                    })->get();

                    if ($academiesWithoutAdmins->isEmpty()) {
                        return [
                            Forms\Components\Placeholder::make('no_academies_notice')
                                ->label('')
                                ->content('All academies currently have an academy admin user.'),
                        ];
                    }

                    $schema = [
                        Forms\Components\TextInput::make('default_password')
                            ->label('Default Password for All New Admins')
                            ->password()
                            ->required()
                            ->default('password')
                            ->minLength(6),
                    ];

                    foreach ($academiesWithoutAdmins as $academy) {
                        $defaultEmail = $academy->contact_email 
                            ?? ('admin@' . ($academy->slug ?: \Illuminate\Support\Str::slug($academy->name)) . '.com');

                        $schema[] = Forms\Components\Section::make($academy->name)
                            ->description("Specify admin details for {$academy->name}")
                            ->schema([
                                Forms\Components\TextInput::make("admins.{$academy->id}.name")
                                    ->label('Admin Name')
                                    ->required()
                                    ->default("{$academy->name} Admin"),
                                
                                Forms\Components\TextInput::make("admins.{$academy->id}.email")
                                    ->label('Admin Email')
                                    ->email()
                                    ->required()
                                    ->unique('users', 'email')
                                    ->default($defaultEmail),
                            ])
                            ->columns(2);
                    }

                    return $schema;
                })
                ->action(function (array $data) {
                    $adminsData = $data['admins'] ?? [];
                    $password = $data['default_password'] ?? 'password';
                    $createdList = [];

                    foreach ($adminsData as $academyId => $adminInfo) {
                        if (empty($adminInfo['email'])) {
                            continue;
                        }

                        $academy = Academy::find($academyId);
                        if (!$academy) {
                            continue;
                        }

                        User::create([
                            'name' => $adminInfo['name'] ?? "{$academy->name} Admin",
                            'email' => $adminInfo['email'],
                            'password' => Hash::make($password),
                            'academy_id' => $academy->id,
                            'role' => 'academy_admin',
                            'status' => 'active',
                            'is_super_admin' => false,
                        ]);

                        $createdList[] = "{$academy->name} ({$adminInfo['email']})";
                    }

                    if (!empty($createdList)) {
                        Notification::make()
                            ->title("Created " . count($createdList) . " academy admin(s)")
                            ->body("Admin user(s) created for:\n• " . implode("\n• ", $createdList))
                            ->success()
                            ->send();
                    } else {
                        Notification::make()
                            ->title('No action taken')
                            ->body('All academies already have admin users or no missing academies were found.')
                            ->warning()
                            ->send();
                    }
                })
                ->modalHeading('Create Missing Academy Admins')
                ->modalDescription('Provide or review email addresses for academies currently missing an admin user.')
                ->modalSubmitActionLabel('Create Admins'),
        ];
    }
}
