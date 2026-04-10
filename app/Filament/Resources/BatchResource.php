<?php

namespace App\Filament\Resources;

use App\Models\Batch;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Support\Enums\FontWeight;

class BatchResource extends Resource
{
    protected static ?string $model = Batch::class;
    protected static ?string $navigationIcon = 'heroicon-o-user-group';
    protected static ?string $navigationLabel = 'Batches';
    protected static ?string $modelLabel = 'Batch';
    protected static ?string $pluralModelLabel = 'Batches';
    protected static ?string $navigationGroup = 'Academy Data';
    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')->required(),
            Forms\Components\TextInput::make('batch_code')->required()->unique(ignoreRecord: true),
            Forms\Components\Select::make('branch_id')
                ->relationship('branch', 'name')
                ->searchable()
                ->required(),
            Forms\Components\Select::make('coach_id')
                ->relationship('coach', 'name')
                ->searchable()
                ->label('Primary Coach'),
            Forms\Components\Textarea::make('description')->rows(3),
            
            // Schedule Information
            Forms\Components\Select::make('days_of_week')
                ->options([
                    'monday' => 'Monday',
                    'tuesday' => 'Tuesday', 
                    'wednesday' => 'Wednesday',
                    'thursday' => 'Thursday',
                    'friday' => 'Friday',
                    'saturday' => 'Saturday',
                    'sunday' => 'Sunday',
                ])
                ->multiple()
                ->required(),
            Forms\Components\TimePicker::make('start_time')->required(),
            Forms\Components\TimePicker::make('end_time')->required(),
            Forms\Components\TextInput::make('schedule')
                ->label('Schedule Text')
                ->helperText('Auto-generated from days and times')
                ->disabled(),
                
            // Batch Details
            Forms\Components\Select::make('skill_level')
                ->options([
                    'beginner' => 'Beginner',
                    'intermediate' => 'Intermediate', 
                    'advanced' => 'Advanced',
                ])
                ->required(),
            Forms\Components\Select::make('age_group')
                ->options([
                    'Kids (5-12)' => 'Kids (5-12)',
                    'Teens (13-17)' => 'Teens (13-17)',
                    'Adults (18+)' => 'Adults (18+)',
                    'Mixed Age' => 'Mixed Age',
                ])
                ->required(),
            Forms\Components\TextInput::make('max_students')
                ->label('Maximum Students')
                ->numeric()
                ->default(20)
                ->required(),
            Forms\Components\TextInput::make('duration_minutes')
                ->label('Duration (minutes)')
                ->numeric()
                ->default(90)
                ->required(),
                
            // Dates
            Forms\Components\DatePicker::make('start_date')->required(),
            Forms\Components\DatePicker::make('end_date'),
            
            // Pricing
            Forms\Components\TextInput::make('monthly_fee')
                ->label('Monthly Fee')
                ->numeric()
                ->step(0.01)
                ->required(),
            Forms\Components\TextInput::make('registration_fee')
                ->label('Registration Fee')
                ->numeric()
                ->step(0.01)
                ->default(0),
                
            // Additional Info
            Forms\Components\TextInput::make('room_location')
                ->label('Room Location'),
            Forms\Components\Toggle::make('is_active')
                ->label('Active')
                ->default(true),
            Forms\Components\Textarea::make('notes')->rows(3),
            
            // Hidden fields for auto-generation
            Forms\Components\Hidden::make('academy_id')
                ->default(fn() => auth()->user()->academy_id),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->heading(fn () => 'Total Batches: ' . \App\Models\Batch::count())
            ->columns([
            Tables\Columns\TextColumn::make('id')->sortable(),
            Tables\Columns\TextColumn::make('name')->searchable()->sortable()->weight(FontWeight::Bold),
            Tables\Columns\TextColumn::make('academy_info')
                ->label('Academy')
                ->getStateUsing(fn ($record) => $record->academy_id . ' - ' . optional($record->academy)->name),
            Tables\Columns\TextColumn::make('branch_info')
                ->label('Branch')
                ->getStateUsing(fn ($record) => $record->branch_id . ' - ' . optional($record->branch)->name),
            Tables\Columns\TextColumn::make('created_at')->dateTime()->sortable(),
        ])
        ->actions([
            Tables\Actions\ViewAction::make(),
            Tables\Actions\EditAction::make(),
            Tables\Actions\DeleteAction::make(),
        ])
        ->defaultSort('created_at', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => BatchResource\Pages\ListBatches::route('/'),
            'view' => BatchResource\Pages\ViewBatch::route('/{record}'),
            'edit' => BatchResource\Pages\EditBatch::route('/{record}/edit'),
        ];
    }
}
