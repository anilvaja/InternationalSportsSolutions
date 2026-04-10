<?php

namespace App\Filament\CentralPanel\Resources;

use App\Filament\CentralPanel\Resources\UserResource\Pages;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Grid;
use Filament\Tables\Actions\ActionGroup;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';

    protected static ?string $navigationGroup = 'User Management';

    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Personal Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('name')
                                    ->required()
                                    ->maxLength(255)
                                    ->label('Full Name'),
                                
                                Forms\Components\TextInput::make('email')
                                    ->email()
                                    ->required()
                                    ->unique(User::class, 'email', ignoreRecord: true)
                                    ->maxLength(255),
                                
                                Forms\Components\TextInput::make('phone')
                                    ->tel()
                                    ->maxLength(255)
                                    ->label('Phone Number'),
                                
                                Forms\Components\DatePicker::make('date_of_birth')
                                    ->label('Date of Birth')
                                    ->displayFormat('d/m/Y'),
                            ]),
                    ])
                    ->columns(2),

                Section::make('Role & Academy Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\Select::make('role')
                                    ->options([
                                        'academy_admin' => 'Academy Admin',
                                        'academy_manager' => 'Academy Manager',
                                        'head_coach' => 'Head Coach',
                                        'assistant_coach' => 'Assistant Coach',
                                        'coach' => 'Coach',
                                        'trainer' => 'Trainer',
                                        'staff' => 'Staff',
                                        'student' => 'Student',
                                    ])
                                    ->required()
                                    ->default('staff')
                                    ->reactive(),
                                
                                Forms\Components\Select::make('academy_id')
                                    ->relationship('academy', 'name')
                                    ->label('Academy')
                                    ->searchable()
                                    ->preload()
                                    ->placeholder('Select an academy')
                                    ->helperText('The academy this user belongs to'),
                            ]),
                        
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('employee_id')
                                    ->maxLength(255)
                                    ->label('Employee ID')
                                    ->unique(User::class, 'employee_id', ignoreRecord: true),
                                
                                Forms\Components\TextInput::make('department')
                                    ->maxLength(255)
                                    ->label('Department'),
                            ]),
                    ])
                    ->columns(2),

                Section::make('Coaching Information')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('coaching_experience')
                                    ->numeric()
                                    ->label('Years of Experience')
                                    ->suffix('years'),
                                
                                Forms\Components\Select::make('specialization')
                                    ->options([
                                        'football' => 'Football',
                                        'basketball' => 'Basketball',
                                        'tennis' => 'Tennis',
                                        'swimming' => 'Swimming',
                                        'cricket' => 'Cricket',
                                        'badminton' => 'Badminton',
                                        'volleyball' => 'Volleyball',
                                        'table_tennis' => 'Table Tennis',
                                        'athletics' => 'Athletics',
                                        'fitness' => 'Fitness Training',
                                        'other' => 'Other',
                                    ])
                                    ->multiple()
                                    ->label('Sport Specialization'),
                                
                                Forms\Components\Textarea::make('certifications')
                                    ->rows(3)
                                    ->label('Certifications & Qualifications')
                                    ->columnSpanFull(),
                            ]),
                    ])
                    ->visible(fn (Forms\Get $get) => in_array($get('role'), ['head_coach', 'assistant_coach', 'coach', 'trainer']))
                    ->columns(2),

                Section::make('Account Security')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Forms\Components\TextInput::make('password')
                                    ->password()
                                    ->dehydrateStateUsing(fn ($state) => Hash::make($state))
                                    ->dehydrated(fn ($state) => filled($state))
                                    ->required(fn (string $context): bool => $context === 'create')
                                    ->minLength(8)
                                    ->label('Password'),
                                
                                Forms\Components\TextInput::make('password_confirmation')
                                    ->password()
                                    ->same('password')
                                    ->dehydrated(false)
                                    ->required(fn (string $context): bool => $context === 'create')
                                    ->label('Confirm Password'),
                            ]),
                        
                        Grid::make(2)
                            ->schema([
                                Forms\Components\Toggle::make('is_active')
                                    ->label('Active User')
                                    ->default(true)
                                    ->helperText('Inactive users cannot login'),
                                
                                Forms\Components\DateTimePicker::make('email_verified_at')
                                    ->label('Email Verified At')
                                    ->displayFormat('d/m/Y H:i')
                                    ->helperText('When the user verified their email'),
                            ]),
                    ])
                    ->columns(2),

                Section::make('Additional Information')
                    ->schema([
                        Forms\Components\Textarea::make('bio')
                            ->rows(3)
                            ->label('Biography')
                            ->maxLength(1000),
                        
                        Forms\Components\Textarea::make('notes')
                            ->rows(3)
                            ->label('Internal Notes')
                            ->maxLength(1000)
                            ->helperText('Internal notes (not visible to user)'),
                    ])
                    ->columns(1),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with(['academy']))
            ->columns([
                Tables\Columns\ImageColumn::make('avatar')
                    ->circular()
                    ->defaultImageUrl(url('/images/default-avatar.png'))
                    ->size(40),
                
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable()
                    ->label('Full Name'),
                
                Tables\Columns\TextColumn::make('email')
                    ->searchable()
                    ->sortable()
                    ->copyable(),
                
                Tables\Columns\BadgeColumn::make('role')
                    ->colors([
                        'danger' => 'academy_admin',
                        'warning' => 'academy_manager',
                        'success' => ['head_coach', 'assistant_coach', 'coach'],
                        'primary' => 'trainer',
                        'secondary' => 'staff',
                        'gray' => 'student',
                    ])
                    ->formatStateUsing(fn (string $state): string => str_replace('_', ' ', ucwords($state))),
                
                Tables\Columns\TextColumn::make('phone')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\TextColumn::make('academy.name')
                    ->label('Academy')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: false)
                    ->placeholder('No Academy'),
                
                Tables\Columns\TextColumn::make('employee_id')
                    ->label('Employee ID')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\TextColumn::make('department')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\IconColumn::make('is_active')
                    ->boolean()
                    ->label('Active')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('email_verified_at')
                    ->dateTime('d/m/Y H:i')
                    ->sortable()
                    ->label('Email Verified')
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime('d/m/Y H:i')
                    ->sortable()
                    ->label('Created')
                    ->toggleable(isToggledHiddenByDefault: true),
                
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime('d/m/Y H:i')
                    ->sortable()
                    ->label('Last Updated')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('academy_id')
                    ->relationship('academy', 'name')
                    ->label('Academy')
                    ->placeholder('All Academies')
                    ->searchable()
                    ->preload(),
                
                Tables\Filters\SelectFilter::make('role')
                    ->options([
                        'academy_admin' => 'Academy Admin',
                        'academy_manager' => 'Academy Manager',
                        'head_coach' => 'Head Coach',
                        'assistant_coach' => 'Assistant Coach',
                        'coach' => 'Coach',
                        'trainer' => 'Trainer',
                        'staff' => 'Staff',
                        'student' => 'Student',
                    ])
                    ->multiple(),
                
                Tables\Filters\Filter::make('is_active')
                    ->query(fn (Builder $query): Builder => $query->where('is_active', true))
                    ->label('Active Users Only'),
                
                Tables\Filters\Filter::make('email_verified')
                    ->query(fn (Builder $query): Builder => $query->whereNotNull('email_verified_at'))
                    ->label('Email Verified Only'),
                
                Tables\Filters\Filter::make('coaches')
                    ->query(fn (Builder $query): Builder => $query->whereIn('role', ['head_coach', 'assistant_coach', 'coach', 'trainer']))
                    ->label('Coaches Only'),
            ])
            ->actions([
                ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\EditAction::make(),
                    Tables\Actions\Action::make('impersonate')
                        ->icon('heroicon-m-finger-print')
                        ->color('warning')
                        ->requiresConfirmation()
                        ->action(function (User $record) {
                            // Implement impersonation logic here
                            session(['impersonating' => $record->id]);
                            return redirect()->route('filament.central.pages.dashboard');
                        })
                        ->visible(fn (User $record) => $record->getKey() !== Auth::id()),
                    
                    Tables\Actions\Action::make('send_password_reset')
                        ->icon('heroicon-m-key')
                        ->color('info')
                        ->requiresConfirmation()
                        ->action(function (User $record) {
                            // Send password reset email
                            $record->sendPasswordResetNotification(
                                app('auth.password.broker')->createToken($record)
                            );
                        }),
                    
                    Tables\Actions\Action::make('toggle_status')
                        ->icon(fn (User $record) => $record->is_active ? 'heroicon-m-x-circle' : 'heroicon-m-check-circle')
                        ->color(fn (User $record) => $record->is_active ? 'danger' : 'success')
                        ->label(fn (User $record) => $record->is_active ? 'Deactivate' : 'Activate')
                        ->requiresConfirmation()
                        ->action(function (User $record) {
                            $record->update(['is_active' => !$record->is_active]);
                        }),
                ])
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    
                    Tables\Actions\BulkAction::make('activate')
                        ->icon('heroicon-m-check-circle')
                        ->color('success')
                        ->requiresConfirmation()
                        ->action(function ($records) {
                            $records->each->update(['is_active' => true]);
                        }),
                    
                    Tables\Actions\BulkAction::make('deactivate')
                        ->icon('heroicon-m-x-circle')
                        ->color('danger')
                        ->requiresConfirmation()
                        ->action(function ($records) {
                            $records->each->update(['is_active' => false]);
                        }),
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
            'view' => Pages\ViewUser::route('/{record}'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }

    public static function getNavigationLabel(): string
    {
        return 'Users';
    }

    public static function getModelLabel(): string
    {
        return 'User';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Users';
    }
}
