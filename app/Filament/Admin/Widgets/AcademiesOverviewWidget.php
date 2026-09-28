<?php

namespace App\Filament\Admin\Widgets;

use App\Models\Academy;
use App\Models\Fee;
use App\Models\EventFee;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Filament\Support\Enums\FontWeight;

class AcademiesOverviewWidget extends BaseWidget
{
    protected static ?int $sort = 4;
    protected int|string|array $columnSpan = 'full';
    protected static ?string $heading = 'Academies Performance & Revenue Summary';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                Academy::query()
                    ->withCount(['students', 'branches'])
                    ->latest('created_at')
            )
            ->columns([
                Tables\Columns\ImageColumn::make('logo')
                    ->circular()
                    ->defaultImageUrl(url('images/default-academy.svg'))
                    ->size(36),

                Tables\Columns\TextColumn::make('name')
                    ->label('Academy Name')
                    ->weight(FontWeight::Bold)
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('contact_email')
                    ->label('Contact Email')
                    ->icon('heroicon-m-envelope')
                    ->searchable(),

                Tables\Columns\TextColumn::make('branches_count')
                    ->label('Branches')
                    ->badge()
                    ->color('info')
                    ->sortable(),

                Tables\Columns\TextColumn::make('students_count')
                    ->label('Total Students')
                    ->badge()
                    ->color('success')
                    ->sortable(),

                Tables\Columns\TextColumn::make('coaches_count')
                    ->label('Coaches')
                    ->state(function (Academy $record) {
                        return \App\Models\Coach::whereHas('user', function ($q) use ($record) {
                            $q->where('academy_id', $record->id);
                        })->count();
                    })
                    ->badge()
                    ->color('warning'),

                Tables\Columns\TextColumn::make('total_revenue')
                    ->label('Total Revenue Collected')
                    ->state(function (Academy $record) {
                        $studentFee = Fee::where('academy_id', $record->id)->where('status', 'paid')->sum('fees_amount');
                        $eventFee = EventFee::whereHas('event', fn ($q) => $q->where('academy_id', $record->id))->where('payment_status', 'paid')->sum('amount');
                        return '₹' . number_format($studentFee + $eventFee, 2);
                    })
                    ->weight(FontWeight::Bold)
                    ->color('success'),

                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'inactive' => 'gray',
                        'suspended' => 'danger',
                        default => 'secondary',
                    }),
            ]);
    }
}
