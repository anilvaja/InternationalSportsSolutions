<?php

namespace App\Helpers;

use Carbon\Carbon;

class AuditHelper
{
    /**
     * Format a field value for display in audit logs
     */
    public static function formatFieldValue(string $fieldName, $value): string
    {
        // Handle null values
        if ($value === null) {
            return 'null';
        }

        // Handle arrays
        if (is_array($value)) {
            return json_encode($value);
        }

        // Handle datetime fields
        if (self::isDateField($fieldName)) {
            return self::formatDateValue($value);
        }

        // Handle boolean values
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        // Handle numeric values
        if (is_numeric($value) && !is_string($value)) {
            return (string) $value;
        }

        // Return as string
        return (string) $value;
    }

    /**
     * Check if a field is a date/datetime field
     */
    protected static function isDateField(string $fieldName): bool
    {
        // Common timestamp fields
        if (in_array($fieldName, ['created_at', 'updated_at', 'deleted_at'])) {
            return true;
        }

        // Fields ending with common date suffixes
        if (preg_match('/_(at|date|time)$/', $fieldName)) {
            return true;
        }

        // Fields containing date/time keywords
        if (preg_match('/(date|time|timestamp)/i', $fieldName)) {
            return true;
        }

        return false;
    }

    /**
     * Format a date value consistently
     */
    protected static function formatDateValue($value): string
    {
        if (empty($value)) {
            return '';
        }

        try {
            // Try to parse as Carbon and format consistently
            $carbon = Carbon::parse($value);
            return $carbon->format('Y-m-d H:i:s');
        } catch (\Exception $e) {
            // If parsing fails, return the original value
            return (string) $value;
        }
    }

    /**
     * Get human-readable field name
     */
    public static function getFieldLabel(string $fieldName): string
    {
        // Convert snake_case to Title Case
        return ucwords(str_replace('_', ' ', $fieldName));
    }

    /**
     * Get CSS class for field value based on field type
     */
    public static function getValueClass(string $fieldName, $value): string
    {
        $baseClass = 'text-sm';

        if ($value === null) {
            return $baseClass . ' text-gray-400 italic';
        }

        if (self::isDateField($fieldName)) {
            return $baseClass . ' font-mono';
        }

        if (is_bool($value)) {
            return $baseClass . ' font-medium';
        }

        if (is_numeric($value)) {
            return $baseClass . ' font-mono';
        }

        return $baseClass;
    }
}
