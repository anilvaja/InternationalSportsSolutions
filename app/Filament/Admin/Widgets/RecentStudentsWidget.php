<?php

namespace App\Filament\Admin\Widgets;

use App\Models\Student;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Filament\Support\Enums\FontWeight;

class RecentStudentsWidget extends BaseWidget
{
    protected static ?int $sort = 2;
    protected int|string|array $columnSpan = 'full';
    protected static ?string $heading = 'Recently Registered Students (System Wide)';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                Student::query()
                    ->with(['academy', 'branch', 'activeBatches'])
                    ->latest('created_at')
                    ->limit(10)
            )
            ->columns([
                Tables\Columns\TextColumn::make('student_id')
                    ->label('Student ID')
                    ->badge()
                    ->color('gray')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('first_name')
                    ->label('Student Name')
                    ->formatStateUsing(fn (Student $record) => "{$record->first_name} {$record->last_name}")
                    ->weight(FontWeight::Bold)
                    ->searchable(['first_name', 'last_name']),

                Tables\Columns\TextColumn::make('academy.name')
                    ->label('Academy')
                    ->badge()
                    ->color('primary')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('branch.name')
                    ->label('Branch')
                    ->placeholder('Main Branch')
                    ->toggleable(),

                Tables\Columns\TextColumn::make('phone')
                    ->label('Contact')
                    ->icon('heroicon-m-phone')
                    ->toggleable(),

                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'inactive' => 'warning',
                        'archived' => 'danger',
                        default => 'secondary',
                    }),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('Joined Date')
                    ->dateTime('M d, Y H:i')
                    ->sortable(),
            ]);
    }
}
