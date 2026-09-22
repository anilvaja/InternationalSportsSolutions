<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PrintController;
use App\Http\Middleware\SetAcademyAuthGuard;

Route::get('/', function () {
    return view('welcome');
});

// Academy print routes (under /print/ to avoid Filament resource {record} collisions)
Route::prefix('academy')->name('academy.')->middleware(['auth:academy', SetAcademyAuthGuard::class])->group(function () {
    Route::get('/print/permissions', [PrintController::class, 'permissions'])->name('permissions.print');
    Route::get('/print/users', [PrintController::class, 'users'])->name('users.print');
    Route::get('/print/roles', [PrintController::class, 'roles'])->name('roles.print');
    Route::get('/print/branches', [PrintController::class, 'branches'])->name('branches.print');
    Route::get('/print/students', [PrintController::class, 'students'])->name('students.print');
    Route::get('/print/attendance', [PrintController::class, 'attendance'])->name('attendance.print');
    Route::get('/print/batches', [PrintController::class, 'batches'])->name('batches.print');
    Route::get('/print/syllabus', [PrintController::class, 'syllabus'])->name('syllabus.print');
    Route::get('/print/coaches', [PrintController::class, 'coaches'])->name('coaches.print');
    Route::get('/print/payments', [PrintController::class, 'payments'])->name('payments.print');
    Route::get('/print/reports', [PrintController::class, 'reports'])->name('reports.print');
    Route::get('/print/fees/{fee}', [PrintController::class, 'fee'])->name('fee.print');
    Route::get('/print/events/{event}/participants', [PrintController::class, 'eventParticipants'])->name('events.participants.print');
});

