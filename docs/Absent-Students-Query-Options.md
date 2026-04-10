# Absent Students Query Options

Based on your data (4 total absent records, no students with 3+ absences), here are different query approaches:

## Option 1: Current Implementation (Any Absences)
Shows students with ANY absences in the last 30 days:

```php
private function getAbsenteeStudentsQuery(): Builder
{
    $academyId = Auth::user()->academy_id;
    
    return Student::query()
        ->select([
            'students.id as student_id',
            'students.first_name',
            'students.last_name', 
            'students.student_id as student_code',
            'students.phone',
            'students.parent_phone',
            'students.parent_email',
            'b.name as batch_name',
            DB::raw('COUNT(sa.id) as consecutive_absences'),
            DB::raw('"No" as notification_sent'),
            DB::raw('(students.first_name || " " || students.last_name) as student_name')
        ])
        ->join('batch_students as bs', 'students.id', '=', 'bs.student_id')
        ->join('batches as b', 'bs.batch_id', '=', 'b.id')
        ->join('student_attendances as sa', 'students.id', '=', 'sa.student_id')
        ->join('batch_attendances as ba', 'sa.batch_attendance_id', '=', 'ba.id')
        ->where('students.academy_id', $academyId)
        ->where('students.status', 'active')
        ->where('bs.is_active', true)
        ->where('ba.academy_id', $academyId)
        ->where('ba.class_date', '>=', now()->subDays(30))
        ->where('sa.status', 'absent')
        ->groupBy([
            'students.id', 'students.first_name', 'students.last_name', 
            'students.student_id', 'students.phone', 'students.parent_phone', 
            'students.parent_email', 'b.name'
        ])
        ->havingRaw('COUNT(sa.id) >= 1') // Any absence
        ->orderByRaw('COUNT(sa.id) DESC');
}
```

## Option 2: Students with 2+ Absences
More realistic threshold:

```php
->havingRaw('COUNT(sa.id) >= 2') // 2 or more absences
```

## Option 3: Simple Raw Query (Most Reliable)
If the above doesn't work, use this direct SQL approach:

```php
private function getAbsenteeStudentsQuery(): Builder
{
    $academyId = Auth::user()->academy_id;
    $cutoffDate = now()->subDays(30)->format('Y-m-d');
    
    $sql = "
        SELECT 
            students.id as student_id,
            students.first_name,
            students.last_name,
            students.student_id as student_code,
            students.phone,
            students.parent_phone,
            students.parent_email,
            'Multiple Batches' as batch_name,
            COUNT(sa.id) as consecutive_absences,
            NULL as last_attendance_date,
            'No' as notification_sent,
            (students.first_name || ' ' || students.last_name) as student_name
        FROM students
        JOIN student_attendances sa ON students.id = sa.student_id
        JOIN batch_attendances ba ON sa.batch_attendance_id = ba.id
        WHERE students.academy_id = ?
          AND students.status = 'active'
          AND ba.class_date >= ?
          AND sa.status = 'absent'
        GROUP BY students.id, students.first_name, students.last_name, 
                 students.student_id, students.phone, students.parent_phone, students.parent_email
        HAVING COUNT(sa.id) >= 1
        ORDER BY consecutive_absences DESC
    ";
    
    return Student::fromQuery($sql, [$academyId, $cutoffDate]);
}
```

## Option 4: For Testing - Show All Students with Any Attendance
While you're testing, you might want to see all students with any attendance record:

```php
private function getAbsenteeStudentsQuery(): Builder
{
    $academyId = Auth::user()->academy_id;
    
    return Student::query()
        ->select([
            'students.id as student_id',
            'students.first_name',
            'students.last_name', 
            'students.student_id as student_code',
            'students.phone',
            'students.parent_phone',
            'students.parent_email',
            DB::raw('"Test Batch" as batch_name'),
            DB::raw('1 as consecutive_absences'),
            DB::raw('NULL as last_attendance_date'),
            DB::raw('"No" as notification_sent'),
            DB::raw('(students.first_name || " " || students.last_name) as student_name')
        ])
        ->where('students.academy_id', $academyId)
        ->where('students.status', 'active')
        ->limit(10); // Show first 10 active students for testing
}
```

## Current Data Status
Based on the test script results:
- Total Students: 150
- Students with any absences (last 30 days): 2
  - Chadd Spinka (ISS250128) - 2 absences
  - Margarett Ferry (ISS250127) - 1 absence
- Students with 3+ absences: 0

## Recommendations

1. **Start with Option 1** (any absences) to see if the widget loads properly
2. **Use Option 4** for initial testing to make sure the widget interface works
3. **Switch to Option 3** if you encounter any SQL compatibility issues
4. **Adjust the minimum absence count** based on your academy's needs (1, 2, or 3)

## To Change the Minimum Absence Count
In any of the queries, modify this line:
```php
->havingRaw('COUNT(sa.id) >= 1') // Change 1 to your desired minimum
```

Values:
- `>= 1`: Shows students with any absence
- `>= 2`: Shows students with 2 or more absences  
- `>= 3`: Shows students with 3 or more absences (your original requirement)
