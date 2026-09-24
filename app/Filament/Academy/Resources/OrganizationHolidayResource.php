<?php

namespace App\Filament\Academy\Resources;

use App\Filament\Academy\Resources\OrganizationHolidayResource\Pages;
use App\Models\OrganizationHoliday;
use Filament\Forms;
use Filament\Forms\Form;
use App\Filament\Academy\Resources\BaseAcademyResource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Filament\Tables\Filters\SelectFilter;

class OrganizationHolidayResource extends BaseAcademyResource
{
    protected static ?string $model = OrganizationHoliday::class;

    protected static ?string $navigationIcon = 'heroicon-o-sun';

    protected static ?string $navigationLabel = 'Holidays';

    protected static ?string $modelLabel = 'Organization Holiday';

    protected static ?string $pluralModelLabel = 'Organization Holidays';

    protected static ?string $navigationGroup = 'SCHEDULE & EVENTS';

    protected static ?int $navigationSort = 2;

    public static function getEloquentQuery(): Builder
    {
        $user = Auth::user();

        return parent::getEloquentQuery()
            ->forAcademy($user->academy_id);
    }

    public static function form(Form $form): Form
    {
        $user = Auth::user();

        return $form
            ->schema([
                Forms\Components\TextInput::make('title')
                    ->label('Holiday Name / Occasion')
                    ->placeholder('e.g. Republic Day, Diwali, Eid-ul-Fitr')
                    ->required(),

                Forms\Components\DatePicker::make('holiday_date')
                    ->label('Holiday Date')
                    ->default(now())
                    ->required(),

                Forms\Components\Select::make('type')
                    ->label('Holiday Type')
                    ->options([
                        'fixed' => 'Fixed Organization Holiday (All Staff)',
                        'flexible_religious' => 'Flexible / Religious Holiday (Optional Claim)',
                    ])
                    ->default('fixed')
                    ->required(),

                Forms\Components\TextInput::make('year')
                    ->label('Year')
                    ->numeric()
                    ->default((int) date('Y'))
                    ->required(),

                Forms\Components\Textarea::make('description')
                    ->label('Description / Details')
                    ->rows(2)
                    ->columnSpanFull(),

                Forms\Components\Hidden::make('academy_id')
                    ->default($user->academy_id),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('title')
                    ->label('Holiday Title')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('holiday_date')
                    ->label('Date')
                    ->date('d/m/Y')
                    ->sortable(),

                Tables\Columns\TextColumn::make('type')
                    ->label('Type')
                    ->badge()
                    ->formatStateUsing(fn ($state) => match ($state) {
                        'fixed' => 'Fixed Holiday',
                        'flexible_religious' => 'Flexible Religious Holiday',
                        default => ucfirst($state),
                    })
                    ->color(fn ($state) => match ($state) {
                        'fixed' => 'success',
                        'flexible_religious' => 'warning',
                        default => 'gray',
                    }),

                Tables\Columns\TextColumn::make('year')
                    ->label('Year')
                    ->sortable(),
            ])
            ->defaultSort('holiday_date', 'asc')
            ->filters([
                SelectFilter::make('type')
                    ->options([
                        'fixed' => 'Fixed Holiday',
                        'flexible_religious' => 'Flexible Religious Holiday',
                    ]),
                SelectFilter::make('year')
                    ->options([
                        2025 => '2025',
                        2026 => '2026',
                        2027 => '2027',
                    ]),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListOrganizationHolidays::route('/'),
        ];
    }
}
