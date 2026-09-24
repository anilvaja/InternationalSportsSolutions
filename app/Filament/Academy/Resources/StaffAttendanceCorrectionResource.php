<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\StaffAttendanceCorrectionResource\Pages;
use App\Models\StaffAttendanceCorrection;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;
use Filament\Tables\Filters\SelectFilter;

class StaffAttendanceCorrectionResource extends BaseAcademyResource
{
    protected static ?string $model = StaffAttendanceCorrection::class;

    protected static ?string $navigationIcon = 'heroicon-o-pencil-square';

    protected static ?string $navigationLabel = 'Attendance Corrections';

    protected static ?string $modelLabel = 'Attendance Correction';

    protected static ?string $pluralModelLabel = 'Attendance Corrections';

    protected static ?string $navigationGroup = 'Staff Management';

    protected static ?int $navigationSort = 2;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();

        return parent::getEloquentQuery()
            ->forAcademy($user->academy_id)
            ->with(['user', 'staffAttendance', 'reviewedBy']);
    }

    public static function form(Form $form): Form
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return $form
            ->schema([
                Forms\Components\Select::make('user_id')
                    ->label('Staff Member')
                    ->options(function () use ($academyId) {
                        return User::where('academy_id', $academyId)
                            ->where('is_super_admin', false)
                            ->pluck('name', 'id');
                    })
                    ->searchable()
                    ->required(),

                Forms\Components\DatePicker::make('request_date')
                    ->label('Attendance Date')
                    ->required(),

                Forms\Components\DateTimePicker::make('requested_check_in')
                    ->label('Requested Check-In Time')
                    ->required(),

                Forms\Components\DateTimePicker::make('requested_check_out')
                    ->label('Requested Check-Out Time')
                    ->required(),

                Forms\Components\TextInput::make('break_duration_minutes')
                    ->label('Break Duration (Minutes)')
                    ->numeric()
                    ->default(0),

                Forms\Components\Textarea::make('reason')
                    ->label('Reason for Correction')
                    ->required()
                    ->rows(3)
                    ->columnSpanFull(),

                Forms\Components\Select::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ])
                    ->default('pending')
                    ->required(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('user.name')
                    ->label('Staff Member')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('request_date')
                    ->label('Target Date')
                    ->date('d/m/Y')
                    ->sortable(),

                Tables\Columns\TextColumn::make('requested_check_in')
                    ->label('Requested Check-In')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),

                Tables\Columns\TextColumn::make('requested_check_out')
                    ->label('Requested Check-Out')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),

                Tables\Columns\TextColumn::make('break_duration_minutes')
                    ->label('Break (Mins)')
                    ->sortable(),

                Tables\Columns\TextColumn::make('reason')
                    ->label('Reason')
                    ->limit(30)
                    ->tooltip(fn ($state) => $state),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'approved' => 'success',
                        'pending' => 'warning',
                        'rejected' => 'danger',
                        default => 'gray',
                    })
                    ->sortable(),

                Tables\Columns\TextColumn::make('reviewedBy.name')
                    ->label('Reviewed By')
                    ->placeholder('Pending')
                    ->sortable(),

                Tables\Columns\TextColumn::make('reviewed_at')
                    ->label('Reviewed At')
                    ->dateTime('d/m/Y H:i')
                    ->placeholder('-'),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make('approve')
                    ->label('Approve')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (StaffAttendanceCorrection $record) => $record->status === 'pending')
                    ->action(function (StaffAttendanceCorrection $record) {
                        $record->approve(Auth::user());

                        Notification::make()
                            ->title('Correction Request Approved')
                            ->body("Attendance updated/created for {$record->user?->name}.")
                            ->success()
                            ->send();
                    }),

                Tables\Actions\Action::make('reject')
                    ->label('Reject')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (StaffAttendanceCorrection $record) => $record->status === 'pending')
                    ->action(function (StaffAttendanceCorrection $record) {
                        $record->reject(Auth::user());

                        Notification::make()
                            ->title('Correction Request Rejected')
                            ->warning()
                            ->send();
                    }),

                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListStaffAttendanceCorrections::route('/'),
        ];
    }
}
