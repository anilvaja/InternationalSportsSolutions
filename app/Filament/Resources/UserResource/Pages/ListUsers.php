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
                        'status' => $data['status'],
                        'is_super_admin' => false,
                    ]);
                })
                ->successNotificationTitle('Academy admin created successfully'),
            
            Actions\Action::make('bulk_create_admins')
                ->label('Bulk Create Academy Admins')
                ->icon('heroicon-o-user-group')
                ->color('info')
                ->action(function () {
                    $academiesWithoutAdmins = Academy::whereDoesntHave('users')->get();
                    
                    $created = 0;
                    foreach ($academiesWithoutAdmins as $academy) {
                        User::create([
                            'name' => "{$academy->name} Admin",
                            'email' => "admin@{$academy->slug}.com",
                            'password' => Hash::make('password'),
                            'academy_id' => $academy->id,
                            'status' => 'active',
                            'is_super_admin' => false,
                        ]);
                        $created++;
                    }
                    
                    if ($created > 0) {
                        Notification::make()
                            ->title("Created {$created} academy admin(s)")
                            ->body("Default password is 'password'. Please ask admins to change it.")
                            ->success()
                            ->send();
                    } else {
                        Notification::make()
                            ->title('No action needed')
                            ->body('All academies already have admin users.')
                            ->warning()
                            ->send();
                    }
                })
                ->requiresConfirmation()
                ->modalHeading('Create Missing Academy Admins')
                ->modalDescription('This will create admin users for academies that don\'t have any users yet.'),
        ];
    }
}
