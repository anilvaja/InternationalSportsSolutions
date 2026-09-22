<?php

namespace App\Filament\Academy\Resources\StaffPayrollResource\Pages;

use App\Filament\Academy\Resources\StaffPayrollResource;
use App\Models\StaffPayroll;
use App\Models\User;
use Filament\Actions;
use Filament\Forms;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Auth;
use Filament\Notifications\Notification;

class ListStaffPayrolls extends ListRecords
{
    protected static string $resource = StaffPayrollResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('generate_payroll')
                ->label('Auto-Generate Payroll Slip')
                ->icon('heroicon-o-calculator')
                ->color('info')
                ->form([
                    Forms\Components\Select::make('user_id')
                        ->label('Staff Member')
                        ->options(function () {
                            $user = Auth::user();
                            return User::where('academy_id', $user->academy_id)
                                ->where('is_super_admin', false)
                                ->pluck('name', 'id');
                        })
                        ->searchable()
                        ->required(),

                    Forms\Components\DatePicker::make('period_start_date')
                        ->label('Start Date')
                        ->default(now()->startOfMonth())
                        ->required(),

                    Forms\Components\DatePicker::make('period_end_date')
                        ->label('End Date')
                        ->default(now()->endOfMonth())
                        ->required(),
                ])
                ->action(function (array $data) {
                    $staff = User::find($data['user_id']);
                    $admin = Auth::user();

                    $payroll = StaffPayroll::generateForUser(
                        $staff,
                        $data['period_start_date'],
                        $data['period_end_date'],
                        $admin->id
                    );

                    Notification::make()
                        ->title('Payroll Slip Generated')
                        ->body("Payroll generated for {$staff->name}. Net Salary: \${$payroll->net_salary}")
                        ->success()
                        ->send();
                }),

            Actions\CreateAction::make()
                ->label('Create Custom Payroll Entry'),
        ];
    }
}
