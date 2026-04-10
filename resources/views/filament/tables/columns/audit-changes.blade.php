@if($getRecord()->changed_fields)
    <div class="space-y-2">
        @foreach($getRecord()->changed_fields as $field => $changes)
            <div class="text-xs border-l-2 border-gray-200 pl-2">
                <div class="font-medium text-gray-700 mb-1">
                    {{ \App\Helpers\AuditHelper::getFieldLabel($field) }}
                </div>
                <div class="flex items-center space-x-2">
                    <span class="{{ \App\Helpers\AuditHelper::getValueClass($field, $changes['old']) }} text-red-600 bg-red-50 px-2 py-1 rounded">
                        {{ \App\Helpers\AuditHelper::formatFieldValue($field, $changes['old']) }}
                    </span>
                    <span class="text-gray-400">→</span>
                    <span class="{{ \App\Helpers\AuditHelper::getValueClass($field, $changes['new']) }} text-green-600 bg-green-50 px-2 py-1 rounded">
                        {{ \App\Helpers\AuditHelper::formatFieldValue($field, $changes['new']) }}
                    </span>
                </div>
            </div>
        @endforeach
    </div>
@else
    <span class="text-gray-400 text-xs italic">No field changes</span>
@endif
