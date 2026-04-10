<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\AuditResource\Pages;
use App\Models\Audit;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Filament\Tables\Columns\ViewColumn;
use Illuminate\Support\Facades\Auth;

class AuditResource extends BaseAcademyResource
{
    protected static ?string $model = Audit::class;
    protected static ?string $navigationIcon = 'heroicon-o-shield-check';
    protected static ?string $navigationLabel = 'Audit Logs';
    protected static ?string $navigationGroup = 'System';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('event')
                    ->disabled(),
                Forms\Components\TextInput::make('auditable_type')
                    ->disabled(),
                Forms\Components\TextInput::make('user_name')
                    ->disabled(),
                Forms\Components\Textarea::make('old_values')
                    ->disabled()
                    ->formatStateUsing(fn ($state) => json_encode($state, JSON_PRETTY_PRINT)),
                Forms\Components\Textarea::make('new_values')
                    ->disabled()
                    ->formatStateUsing(fn ($state) => json_encode($state, JSON_PRETTY_PRINT)),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('ID')
                    ->sortable(),
                
                Tables\Columns\BadgeColumn::make('event')
                    ->label('Action')
                    ->colors([
                        'success' => 'created',
                        'warning' => 'updated',
                        'danger' => 'deleted',
                        'info' => 'restored',
                    ]),
                
                Tables\Columns\TextColumn::make('model_name')
                    ->label('Model')
                    ->sortable()
                    ->searchable(),
                
                Tables\Columns\TextColumn::make('auditable_id')
                    ->label('Record ID')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('user_name')
                    ->label('User')
                    ->sortable()
                    ->searchable(),
                
                Tables\Columns\TextColumn::make('ip_address')
                    ->label('IP Address')
                    ->sortable()
                    ->toggleable(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->label('Date/Time')
                    ->dateTime('d M Y, H:i:s')
                    ->sortable(),
                
                Tables\Columns\ViewColumn::make('changes')
                    ->label('Changes')
                    ->view('filament.tables.columns.audit-changes')
                    ->toggleable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('event')
                    ->options([
                        'created' => 'Created',
                        'updated' => 'Updated',
                        'deleted' => 'Deleted',
                        'restored' => 'Restored',
                    ]),
                
                Tables\Filters\SelectFilter::make('auditable_type')
                    ->label('Model Type')
                    ->options([
                        'App\\Models\\Event' => 'Event',
                        'App\\Models\\EventFee' => 'Event Fee',
                        'App\\Models\\EventParticipant' => 'Event Participant',
                        'App\\Models\\Student' => 'Student',
                        'App\\Models\\User' => 'User',
                    ]),
                
                Tables\Filters\SelectFilter::make('user_type')
                    ->label('User Type')
                    ->options([
                        'App\\Models\\User' => 'Admin/Staff',
                        'App\\Models\\Student' => 'Student',
                    ]),
                
                Tables\Filters\Filter::make('date_range')
                    ->form([
                        Forms\Components\DatePicker::make('from'),
                        Forms\Components\DatePicker::make('until'),
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        return $query
                            ->when(
                                $data['from'],
                                fn (Builder $query, $date): Builder => $query->whereDate('created_at', '>=', $date),
                            )
                            ->when(
                                $data['until'],
                                fn (Builder $query, $date): Builder => $query->whereDate('created_at', '<=', $date),
                            );
                    }),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
            ])
            ->defaultSort('created_at', 'desc')
            ->poll('30s'); // Auto-refresh every 30 seconds
    }

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();
        $academyId = $user->academy_id;

        return parent::getEloquentQuery()
            ->where(function (Builder $query) use ($academyId) {
                $query
                    // Filter audits for Events that belong to the current academy
                    ->where(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\Event')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('id')
                                       ->from('events')
                                       ->where('academy_id', $academyId);
                          });
                    })
                    // Filter audits for Event Fees through events
                    ->orWhere(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\EventFee')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('event_fees.id')
                                       ->from('event_fees')
                                       ->join('events', 'event_fees.event_id', '=', 'events.id')
                                       ->where('events.academy_id', $academyId);
                          });
                    })
                    // Filter audits for Students that belong to the current academy
                    ->orWhere(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\Student')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('id')
                                       ->from('students')
                                       ->where('academy_id', $academyId);
                          });
                    })
                    // Filter audits for Users that belong to the current academy
                    ->orWhere(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\User')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('id')
                                       ->from('users')
                                       ->where('academy_id', $academyId);
                          });
                    })
                    // Filter audits for Event Participants through events
                    ->orWhere(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\EventParticipant')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('event_participants.id')
                                       ->from('event_participants')
                                       ->join('events', 'event_participants.event_id', '=', 'events.id')
                                       ->where('events.academy_id', $academyId);
                          });
                    })
                    // Filter audits for Batches that belong to the current academy
                    ->orWhere(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\Batch')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('id')
                                       ->from('batches')
                                       ->where('academy_id', $academyId);
                          });
                    })
                    // Filter audits for Student Attendances
                    ->orWhere(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\StudentAttendance')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('id')
                                       ->from('student_attendances')
                                       ->where('academy_id', $academyId);
                          });
                    })
                    // Filter audits for Batch Attendances
                    ->orWhere(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\BatchAttendance')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('id')
                                       ->from('batch_attendances')
                                       ->where('academy_id', $academyId);
                          });
                    })
                    // Filter audits for Academy Roles that belong to the current academy
                    ->orWhere(function (Builder $q) use ($academyId) {
                        $q->where('auditable_type', 'App\\Models\\AcademyRole')
                          ->whereIn('auditable_id', function ($subQuery) use ($academyId) {
                              $subQuery->select('id')
                                       ->from('academy_roles')
                                       ->where('academy_id', $academyId);
                          });
                    });
            });
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAudits::route('/'),
            'view' => Pages\ViewAudit::route('/{record}'),
        ];
    }


    // Removed custom permission methods to rely on trait-based logic
}
