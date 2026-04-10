# Fee Resource Permission Fixes

## Issue Summary
Academy admin users with admin role couldn't see add/create and edit/delete options in the FeeResource.

## Root Cause
The FeeResource was overriding the permission methods from BaseAcademyResource and using `AcademyPermissionHelper::can()` which was checking for specific permissions that might not exist or be properly assigned to academy admin users.

## Changes Made

### 1. Removed Permission Method Overrides
**Before:** FeeResource had custom permission methods:
```php
public static function canViewAny(): bool
{
    return \App\Support\AcademyPermissionHelper::can('view_fees');
}

public static function canCreate(): bool
{
    return \App\Support\AcademyPermissionHelper::can('create_fees');
}

public static function canEdit($record): bool
{
    return \App\Support\AcademyPermissionHelper::can('edit_fees');
}

public static function canDelete($record): bool
{
    return \App\Support\AcademyPermissionHelper::can('delete_fees');
}
```

**After:** These methods were removed, allowing FeeResource to inherit from BaseAcademyResource which currently allows all academy users to perform all actions.

### 2. Added Missing Delete Action
Added `Tables\Actions\DeleteAction::make()` to the table actions to ensure delete functionality is available.

### 3. Added Header Action for Creating Fees
Added a header action for creating new fee records:
```php
->headerActions([
    Tables\Actions\CreateAction::make()
        ->label('Collect Fee')
        ->icon('heroicon-o-plus'),
])
```

### 4. Added Permission Name Method
Added the `getAcademyPermissionName()` method to ensure consistent permission naming when permissions are re-enabled:
```php
public static function getAcademyPermissionName(string $action): string
{
    return $action . '_fees';
}
```

## Result
Academy admin users should now be able to:
- ✅ View the fee collection list
- ✅ Create new fee records (via "Collect Fee" button and Create action)
- ✅ Edit existing fee records
- ✅ Delete fee records
- ✅ View fee details
- ✅ Print receipts for paid fees

## Testing Steps
1. Log in as academy admin user with admin role
2. Navigate to Academy Panel → Fee Collection
3. Verify you can see:
   - "Collect Fee" button in the header
   - Edit icons on each fee record
   - Delete icons on each fee record
   - View icons on each fee record
4. Test creating a new fee record
5. Test editing an existing fee record

## Note
The current permission system in BaseAcademyResource is temporarily set to allow all academy users full access. When proper permission granularity is needed later, the permission checks can be re-enabled with proper database permissions in place.
