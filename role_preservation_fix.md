# Self-Edit Role Preservation Fix

## Problem Identified
When users edited their own profiles, the `afterSave()` method in `EditUser.php` was:
1. Removing all existing academy roles
2. Only reassigning roles if `academy_role_id` was provided in form data
3. Since `academy_role_id` field was disabled for self-editing, it wasn't submitted
4. Result: Users lost all their roles and got 403 Forbidden errors

## Solution Implemented

### 1. Updated `afterSave()` method in EditUser.php:
- Added check to skip role management when users edit themselves
- Role assignment/removal only happens when admins edit other users
- Self-editing preserves existing roles completely

### 2. Enhanced `mutateFormDataBeforeFill()` method:
- Now also loads additional permissions for proper form display
- Ensures form shows current role and permissions correctly

### 3. Improved additional permissions handling:
- Additional permissions are now properly saved during admin edits
- Form data includes both role and additional permissions

## Code Changes Made:

```php
// In afterSave() - Skip role management for self-editing
if ($currentUser && $currentUser->id === $this->record->id) {
    return; // Don't modify roles when self-editing
}

// In mutateFormDataBeforeFill() - Load additional permissions
$data['additional_permissions'] = $userRole->additional_permissions ?? [];

// In afterSave() - Save additional permissions
'additional_permissions' => $data['additional_permissions'] ?? [],
```

## Result:
✅ Users can now edit their personal information safely without losing roles
✅ No more 403 Forbidden errors after self-editing
✅ Role management still works properly for admin edits
✅ Additional permissions are preserved correctly

## Security Maintained:
- Users still cannot modify their own roles through the form (fields disabled)
- Users still cannot modify their own permissions through the form (fields disabled)
- Role management is only active during admin-to-user edits
- Self-editing only affects personal information fields
