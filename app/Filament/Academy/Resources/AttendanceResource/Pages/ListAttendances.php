<?php

namespace App\Filament\Academy\Resources\AttendanceResource\Pages;

use App\Filament\Academy\Resources\AttendanceResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Database\Eloquent\Builder;

use Filament\Forms;
use Illuminate\Support\Facades\Auth;

class ListAttendances extends ListRecords
{
    protected static string $resource = AttendanceResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('quick_take_attendance')
                ->label('Take Attendance by Batch')
                ->icon('heroicon-o-academic-cap')
                ->color('success')
                ->modalHeading('Select Batch for Attendance')
                ->modalDescription('Choose an assigned batch to auto-fill class timing, student roster, and technique progress.')
                ->form([
                    Forms\Components\Select::make('batch_id')
                        ->label('Select Batch')
                        ->options(function () {
                            $user = Auth::user();
                            $query = \App\Models\Batch::where('academy_id', $user->academy_id)->where('is_active', true);
                            
                            $myBatches = (clone $query)->where('coach_id', $user->id)->pluck('name', 'id');
                            if ($myBatches->isNotEmpty()) {
                                $otherBatches = (clone $query)->where(function($q) use ($user) {
                                    $q->where('coach_id', '!=', $user->id)->orWhereNull('coach_id');
                                })->pluck('name', 'id');

                                $options = ['My Assigned Batches' => $myBatches->toArray()];
                                if ($otherBatches->isNotEmpty()) {
                                    $options['Other Academy Batches'] = $otherBatches->toArray();
                                }
                                return $options;
                            }
                            return $query->pluck('name', 'id')->toArray();
                        })
                        ->required()
                        ->searchable(),
                ])
                ->action(function (array $data) {
                    return redirect(route('filament.academy.resources.attendances.create', ['batch_id' => $data['batch_id']]));
                }),

            Actions\CreateAction::make()
                ->label('New Attendance'),
        ];
    }

    protected function getTableQuery(): Builder
    {
        return parent::getTableQuery()
            ->with(['batch', 'studentAttendances', 'attendanceMarkedBy']);
    }
}
