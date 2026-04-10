<?php

namespace App\Filament\Resources;

use App\Models\Student;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Support\Enums\FontWeight;

class StudentResource extends Resource
{
    protected static ?string $model = Student::class;
    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';
    protected static ?string $navigationLabel = 'Students';
    protected static ?string $modelLabel = 'Student';
    protected static ?string $pluralModelLabel = 'Students';
    protected static ?string $navigationGroup = 'Academy Data';
    protected static ?int $navigationSort = 4;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('student_id')->label('Student ID')->required(),
            Forms\Components\TextInput::make('first_name')->required(),
            Forms\Components\TextInput::make('last_name')->required(),
            Forms\Components\TextInput::make('academy_id')->required()->numeric(),
            Forms\Components\TextInput::make('branch_id')->required()->numeric(),
            Forms\Components\TextInput::make('email'),
            Forms\Components\TextInput::make('phone'),
            Forms\Components\DatePicker::make('date_of_birth'),
            Forms\Components\TextInput::make('status'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->heading(fn () => 'Total Students: ' . \App\Models\Student::count())
            ->columns([
            Tables\Columns\TextColumn::make('id')->sortable(),
            Tables\Columns\TextColumn::make('student_id')->label('Student ID')->searchable()->sortable(),
            Tables\Columns\TextColumn::make('first_name')->searchable(),
            Tables\Columns\TextColumn::make('last_name')->searchable(),
            Tables\Columns\TextColumn::make('academy_info')
                ->label('Academy')
                ->getStateUsing(fn ($record) => $record->academy_id . ' - ' . optional($record->academy)->name),
            Tables\Columns\TextColumn::make('branch_info')
                ->label('Branch')
                ->getStateUsing(fn ($record) => $record->branch_id . ' - ' . optional($record->branch)->name),
            Tables\Columns\TextColumn::make('created_at')->dateTime()->sortable(),
        ])
        ->filters([
            Tables\Filters\SelectFilter::make('academy_id')
                ->label('Academy')
                ->options(\App\Models\Academy::all()->pluck('name', 'id')->toArray()),
            Tables\Filters\SelectFilter::make('branch_id')
                ->label('Branch')
                ->options(\App\Models\Branch::all()->pluck('name', 'id')->toArray()),
        ])
        ->actions([
            Tables\Actions\ViewAction::make(),
            Tables\Actions\EditAction::make(),
            Tables\Actions\DeleteAction::make(),
        ])
    ->paginated([10, 25, 50, 100])
    ->defaultSort('created_at', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => StudentResource\Pages\ListStudents::route('/'),
            'view' => StudentResource\Pages\ViewStudent::route('/{record}'),
            'edit' => StudentResource\Pages\EditStudent::route('/{record}/edit'),
        ];
    }
}
