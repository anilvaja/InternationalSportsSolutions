# Attendance System Architecture

## Overview
The attendance system supports both individual student attendance tracking and class-level management (when entire classes are skipped/cancelled).

## Database Structure

### Attendances Table
The `attendances` table serves dual purposes:

1. **Individual Student Attendance** (when `student_id` is NOT NULL)
2. **Class-Level Skip/Cancellation** (when `student_id` IS NULL)

## Use Cases

### 1. Normal Class Day - Individual Student Attendance
For each student in the batch, create an attendance record:
```php
// Example: Recording attendance for students in a batch
Attendance::create([
    'student_id' => 1,
    'batch_id' => 5,
    'class_date' => '2025-07-27',
    'class_start_time' => '18:00:00',
    'class_end_time' => '19:30:00',
    'status' => 'present',
    'actual_arrival_time' => '17:58:00',
    'marked_by' => 2, // Coach ID
    'participation_level' => 4,
    'techniques_practiced' => ['front_kick', 'roundhouse_kick'],
    'primary_technique_focused_id' => 15,
    'last_technique_learned_id' => 15, // If student mastered this technique
    'technique_mastered' => true,
    'progress_notes' => 'Excellent improvement in kicks',
    'is_class_skipped' => false
]);
```

### 2. Class Cancelled/Skipped - Batch Level
When an entire class is cancelled, create ONE record for the batch:
```php
// Example: Cancelling entire class due to holiday
Attendance::create([
    'student_id' => null, // NULL for batch-level record
    'batch_id' => 5,
    'class_date' => '2025-07-27',
    'class_start_time' => null,
    'class_end_time' => null,
    'status' => 'class_cancelled',
    'marked_by' => 2, // Staff who marked it cancelled
    'is_class_skipped' => true,
    'skip_reason' => 'holiday',
    'skip_notes' => 'National holiday - Independence Day',
    'notes' => 'Class will be made up next week'
]);
```

## UI Implementation Guidelines

### Attendance Screen Flow

#### 1. Check for Class Status
```php
// First check if class was already marked as skipped
$classSkipped = Attendance::where('batch_id', $batchId)
    ->where('class_date', $classDate)
    ->where('is_class_skipped', true)
    ->whereNull('student_id')
    ->first();

if ($classSkipped) {
    // Show class skip information
    // Allow editing of skip reason/notes
    // Show "Resume Class" option
}
```

#### 2. Show Student List with Attendance Options
```php
// Get all students in the batch
$students = $batch->students()->where('status', 'active')->get();

foreach ($students as $student) {
    // Get existing attendance record
    $attendance = Attendance::where('student_id', $student->id)
        ->where('batch_id', $batchId)
        ->where('class_date', $classDate)
        ->first();
    
    // Show attendance status dropdown
    // Show technique selection (from syllabus_techniques)
    // Show last technique learned for this student
}
```

#### 3. Technique Progress Tracking
```php
// Get student's current technique progress
$lastLearnedTechnique = Attendance::where('student_id', $studentId)
    ->whereNotNull('last_technique_learned_id')
    ->orderBy('class_date', 'desc')
    ->first()
    ->lastTechniqueeLearned ?? null;

// Show techniques in order for selection
$availableTechniques = SyllabusTechnique::orderBy('sort_order')->get();
```

## Key Features

### 1. Technique Progress Tracking
- Each attendance record can track which technique the student mastered
- `last_technique_learned_id` shows the most recent technique the student completed
- `technique_mastered` boolean indicates if student mastered the focused technique in that class
- `techniques_practiced` JSON array lists all techniques covered in the class

### 2. Class Management
- Skip entire classes with reason and notes
- No individual student records needed when class is skipped
- Easy reporting on cancelled vs completed classes

### 3. Flexible Attendance States
- `present` - Student attended normally
- `absent` - Student did not attend
- `late` - Student arrived late
- `excused` - Planned absence
- `makeup` - Making up a previously missed class
- `class_cancelled` - Used for batch-level cancellations

### 4. Progress Reports
```sql
-- Get student's technique progression
SELECT 
    a.class_date,
    st.name as technique_learned,
    a.technique_mastered,
    a.progress_notes
FROM attendances a
LEFT JOIN syllabus_techniques st ON a.last_technique_learned_id = st.id
WHERE a.student_id = ? AND a.last_technique_learned_id IS NOT NULL
ORDER BY a.class_date DESC;

-- Get class cancellation history
SELECT 
    class_date,
    skip_reason,
    skip_notes
FROM attendances 
WHERE batch_id = ? AND is_class_skipped = true
ORDER BY class_date DESC;
```

## Database Constraints

1. **Unique Constraint**: `student_id`, `batch_id`, `class_date` must be unique (prevents duplicate individual attendance)
2. **Nullable student_id**: Allows batch-level records
3. **Conditional Fields**: Some fields only apply to individual vs batch records
4. **Foreign Key Constraints**: Ensures data integrity

## Implementation Tips

1. **UI Toggle**: Provide a "Skip Entire Class" toggle at the top of attendance screen
2. **Bulk Operations**: When marking class as skipped, hide individual student controls
3. **Technique Selection**: Use dropdown/autocomplete for technique selection
4. **Progress Visualization**: Show technique progression timeline for each student
5. **Parent Notifications**: Automatically notify parents of attendance status
6. **Make-up Classes**: Link makeup attendance to original missed class
