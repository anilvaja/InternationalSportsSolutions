<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\StaffLeaveResource\Pages;
use App\Models\StaffLeave;
use App\Models\User;
use App\Models\OrganizationHoliday;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;
use Filament\Tables\Filters\SelectFilter;
use Carbon\Carbon;

class StaffLeaveResource extends BaseAcademyResource
{
    protected static ?string $model = StaffLeave::class;

    protected static ?string $navigationIcon = 'heroicon-o-document-text';

    protected static ?string $navigationLabel = 'Staff Leaves & Approvals';

    protected static ?string $modelLabel = 'Staff Leave';

    protected static ?string $pluralModelLabel = 'Staff Leaves';

    protected static ?string $navigationGroup = 'Staff Management';

    protected static ?int $navigationSort = 5;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();

        return parent::getEloquentQuery()
            ->forAcademy($user->academy_id)
            ->with(['user', 'organizationHoliday', 'reviewedBy']);
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

                Forms\Components\Select::make('leave_type')
                    ->label('Leave Type')
                    ->options([
                        'fixed_paid' => 'Fixed Paid Leave',
                        'flexible_religious' => 'Flexible Religious Holiday Claim',
                        'casual' => 'Casual Leave',
                        'sick' => 'Sick Leave',
                        'unpaid' => 'Unpaid Leave',
                    ])
                    ->reactive()
                    ->default('fixed_paid')
                    ->required(),

                Forms\Components\Select::make('organization_holiday_id')
                    ->label('Select Flexible Religious Holiday')
                    ->options(function () use ($academyId) {
                        return OrganizationHoliday::forAcademy($academyId)
                            ->where('type', 'flexible_religious')
                            ->pluck('title', 'id');
                    })
                    ->visible(fn (Forms\Get $get) => $get('leave_type') === 'flexible_religious')
                    ->searchable(),

                Forms\Components\DatePicker::make('start_date')
                    ->label('Start Date')
                    ->default(now())
                    ->required()
                    ->reactive()
                    ->afterStateUpdated(function ($state, Forms\Get $get, Forms\Set $set) {
                        $end = $get('end_date');
                        if ($state && $end) {
                            $days = Carbon::parse($state)->diffInDays(Carbon::parse($end)) + 1;
                            $set('total_days', max(1, $days));
                        }
                    }),

                Forms\Components\DatePicker::make('end_date')
                    ->label('End Date')
                    ->default(now())
                    ->required()
                    ->reactive()
                    ->afterStateUpdated(function ($state, Forms\Get $get, Forms\Set $set) {
                        $start = $get('start_date');
                        if ($state && $start) {
                            $days = Carbon::parse($start)->diffInDays(Carbon::parse($state)) + 1;
                            $set('total_days', max(1, $days));
                        }
                    }),

                Forms\Components\TextInput::make('total_days')
                    ->label('Total Days')
                    ->numeric()
                    ->default(1.0)
                    ->required(),

                Forms\Components\Toggle::make('is_paid')
                    ->label('Is Paid Leave?')
                    ->default(true),

                Forms\Components\Textarea::make('reason')
                    ->label('Reason for Leave')
                    ->rows(2)
                    ->columnSpanFull(),

                Forms\Components\Select::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ])
                    ->default('pending')
                    ->required(),

                Forms\Components\Hidden::make('academy_id')
                    ->default($academyId),
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

                Tables\Columns\TextColumn::make('leave_type')
                    ->label('Type')
                    ->badge()
                    ->formatStateUsing(fn ($state) => ucfirst(str_replace('_', ' ', $state)))
                    ->color('secondary'),

                Tables\Columns\TextColumn::make('organizationHoliday.title')
                    ->label('Holiday Claim')
                    ->placeholder('-'),

                Tables\Columns\TextColumn::make('start_date')
                    ->label('Start Date')
                    ->date('d/m/Y')
                    ->sortable(),

                Tables\Columns\TextColumn::make('end_date')
                    ->label('End Date')
                    ->date('d/m/Y')
                    ->sortable(),

                Tables\Columns\TextColumn::make('total_days')
                    ->label('Duration')
                    ->suffix(' days')
                    ->sortable(),

                Tables\Columns\IconColumn::make('is_paid')
                    ->label('Paid?')
                    ->boolean(),

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
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ]),
                SelectFilter::make('leave_type')
                    ->options([
                        'fixed_paid' => 'Fixed Paid Leave',
                        'flexible_religious' => 'Flexible Religious Holiday',
                        'casual' => 'Casual Leave',
                        'sick' => 'Sick Leave',
                        'unpaid' => 'Unpaid Leave',
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make('approve')
                    ->label('Approve Leave')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (StaffLeave $record) => $record->status === 'pending')
                    ->action(function (StaffLeave $record) {
                        $record->approve(Auth::user());

                        Notification::make()
                            ->title('Leave Approved')
                            ->body("Leave approved for {$record->user?->name}. Attendance marked as On Leave.")
                            ->success()
                            ->send();
                    }),

                Tables\Actions\Action::make('reject')
                    ->label('Reject Leave')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (StaffLeave $record) => $record->status === 'pending')
                    ->form([
                        Forms\Components\Textarea::make('rejection_reason')
                            ->label('Reason for Rejection')
                            ->required(),
                    ])
                    ->action(function (StaffLeave $record, array $data) {
                        $record->reject(Auth::user(), $data['rejection_reason']);

                        Notification::make()
                            ->title('Leave Request Rejected')
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
            'index' => Pages\ListStaffLeaves::route('/'),
        ];
    }
}
