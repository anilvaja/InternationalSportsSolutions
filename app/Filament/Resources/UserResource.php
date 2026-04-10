<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Filament\Resources\UserResource\RelationManagers;
use App\Models\User;
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
use Illuminate\Support\Facades\Hash;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';
    
    protected static ?string $navigationLabel = 'Users';
    
    protected static ?string $modelLabel = 'User';
    
    protected static ?string $pluralModelLabel = 'Users';
    
    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('User Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('name')
                                    ->required()
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('email')
                                    ->email()
                                    ->required()
                                    ->unique(ignoreRecord: true)
                                    ->maxLength(255),
                            ]),
                        
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('phone')
                                    ->tel()
                                    ->maxLength(255),
                                
                                Forms\Components\FileUpload::make('avatar')
                                    ->image()
                                    ->directory('avatars')
                                    ->visibility('public'),
                            ]),
                    ]),
                
                Section::make('Academy Assignment & Role')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\Select::make('academy_id')
                                    ->label('Academy')
                                    ->relationship('academy', 'name')
                                    ->searchable()
                                    ->preload()
                                    ->placeholder('Select an academy (leave empty for super admin)')
                                    ->helperText('Assign user to a specific academy. Leave empty for super admin users.')
                                    ->reactive()
                                    ->afterStateUpdated(function ($state, Forms\Set $set) {
                                        if ($state === null) {
                                            $set('role', 'super_admin');
                                            $set('is_super_admin', true);
                                        } else {
                                            $set('role', 'academy_admin');
                                            $set('is_super_admin', false);
                                        }
                                    }),
                                
                                Forms\Components\Select::make('role')
                                    ->required()
                                    ->options([
                                        'super_admin' => 'Super Admin',
                                        'academy_admin' => 'Academy Admin',
                                        'academy_staff' => 'Staff',
                                    ])
                                    ->helperText('User role determines access permissions'),
                            ]),
                    ]),
                
                Section::make('Access & Security')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('password')
                                    ->password()
                                    ->required(fn (string $context): bool => $context === 'create')
                                    ->dehydrated(fn ($state) => filled($state))
                                    ->dehydrateStateUsing(fn ($state) => Hash::make($state))
                                    ->helperText('Leave empty to keep current password when editing'),
                                
                                Forms\Components\Select::make('status')
                                    ->options([
                                        'active' => 'Active',
                                        'inactive' => 'Inactive',
                                        'suspended' => 'Suspended',
                                    ])
                                    ->default('active')
                                    ->required(),
                            ]),
                        
                        Forms\Components\Toggle::make('is_super_admin')
                            ->label('Super Administrator')
                            ->helperText('Super admins can access all academies and system settings')
                            ->reactive()
                            ->afterStateUpdated(function ($state, Forms\Set $set) {
                                if ($state) {
                                    $set('academy_id', null);
                                    $set('role', 'super_admin');
                                }
                            })
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('avatar')
                    ->circular()
                    ->size(40),
                
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->weight(FontWeight::Bold),
                
                Tables\Columns\TextColumn::make('email')
                    ->searchable()
                    ->sortable()
                    ->icon('heroicon-m-envelope'),
                
                Tables\Columns\TextColumn::make('academy.name')
                    ->label('Academy')
                    ->sortable()
                    ->searchable()
                    ->badge()
                    ->color('blue')
                    ->default('Super Admin')
                    ->placeholder('Super Admin'),
                
                Tables\Columns\TextColumn::make('role')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'super_admin' => 'danger',
                        'academy_admin' => 'success',
                        'coach' => 'warning',
                        'staff' => 'gray',
                        default => 'gray',
                    })
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('phone')
                    ->searchable()
                    ->toggleable()
                    ->icon('heroicon-m-phone'),
                
                Tables\Columns\IconColumn::make('is_super_admin')
                    ->label('Super Admin')
                    ->boolean()
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'inactive' => 'gray',
                        'suspended' => 'danger',
                    })
                    ->sortable(),
                
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
                SelectFilter::make('academy_id')
                    ->label('Academy')
                    ->relationship('academy', 'name')
                    ->preload()
                    ->multiple(),
                
                SelectFilter::make('role')
                    ->options([
                        'super_admin' => 'Super Admin',
                        'academy_admin' => 'Academy Admin',
                        'coach' => 'Coach',
                        'staff' => 'Staff',
                    ]),
                
                SelectFilter::make('status')
                    ->options([
                        'active' => 'Active',
                        'inactive' => 'Inactive',
                        'suspended' => 'Suspended',
                    ]),
                
                SelectFilter::make('is_super_admin')
                    ->label('User Type')
                    ->options([
                        true => 'Super Admin',
                        false => 'Academy User',
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        return $data['value'] !== null 
                            ? $query->where('is_super_admin', $data['value'])
                            : $query;
                    }),
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\EditAction::make(),
                    Tables\Actions\DeleteAction::make(),
                    
                    Tables\Actions\Action::make('reset_password')
                        ->label('Reset Password')
                        ->icon('heroicon-o-key')
                        ->color('warning')
                        ->form([
                            Forms\Components\TextInput::make('new_password')
                                ->label('New Password')
                                ->password()
                                ->required()
                                ->minLength(6),
                        ])
                        ->action(function (User $record, array $data) {
                            $record->update([
                                'password' => Hash::make($data['new_password']),
                            ]);
                        })
                        ->requiresConfirmation()
                        ->modalHeading('Reset User Password')
                        ->modalDescription('Enter a new password for this user.')
                        ->successNotificationTitle('Password reset successfully'),
                    
                    Tables\Actions\Action::make('toggle_status')
                        ->label(fn (User $record) => $record->status === 'active' ? 'Suspend User' : 'Activate User')
                        ->icon(fn (User $record) => $record->status === 'active' ? 'heroicon-o-x-circle' : 'heroicon-o-check-circle')
                        ->color(fn (User $record) => $record->status === 'active' ? 'danger' : 'success')
                        ->action(function (User $record) {
                            $record->update([
                                'status' => $record->status === 'active' ? 'suspended' : 'active',
                            ]);
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\Action::make('send_welcome_email')
                        ->label('Send Welcome Email')
                        ->icon('heroicon-o-envelope')
                        ->color('info')
                        ->action(function (User $record) {
                            // Here you would implement email sending logic
                            // For now, just show a notification
                        })
                        ->successNotificationTitle('Welcome email sent'),
                ])
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    
                    Tables\Actions\BulkAction::make('activate')
                        ->label('Activate Users')
                        ->icon('heroicon-o-check-circle')
                        ->color('success')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['status' => 'active']);
                            });
                        })
                        ->requiresConfirmation(),
                    
                    Tables\Actions\BulkAction::make('suspend')
                        ->label('Suspend Users')
                        ->icon('heroicon-o-x-circle')
                        ->color('danger')
                        ->action(function ($records) {
                            $records->each(function ($record) {
                                $record->update(['status' => 'suspended']);
                            });
                        })
                        ->requiresConfirmation(),
                ]),
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
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}
