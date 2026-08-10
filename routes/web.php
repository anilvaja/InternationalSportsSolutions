<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PrintController;

Route::get('/', function () {
    return view('welcome');
});

// Academy print routes
Route::prefix('academy')->name('academy.')->group(function () {
    Route::get('/permissions/print', [PrintController::class, 'permissions'])->name('permissions.print');
    Route::get('/users/print', [PrintController::class, 'users'])->name('users.print');
    Route::get('/roles/print', [PrintController::class, 'roles'])->name('roles.print');
    Route::get('/branches/print', [PrintController::class, 'branches'])->name('branches.print');
    Route::get('/students/print', [PrintController::class, 'students'])->name('students.print');
    Route::get('/attendance/print', [PrintController::class, 'attendance'])->name('attendance.print');
    Route::get('/batches/print', [PrintController::class, 'batches'])->name('batches.print');
    Route::get('/syllabus/print', [PrintController::class, 'syllabus'])->name('syllabus.print');
    Route::get('/coaches/print', [PrintController::class, 'coaches'])->name('coaches.print');
    Route::get('/payments/print', [PrintController::class, 'payments'])->name('payments.print');
    Route::get('/reports/print', [PrintController::class, 'reports'])->name('reports.print');
    Route::get('/fees/{fee}/print', [PrintController::class, 'fee'])->name('fee.print');
    Route::get('/events/{event}/participants/print', [PrintController::class, 'eventParticipants'])->name('events.participants.print');
});
