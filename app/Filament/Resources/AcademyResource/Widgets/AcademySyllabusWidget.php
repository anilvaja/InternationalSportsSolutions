<?php

namespace App\Filament\Resources\AcademyResource\Widgets;

use App\Models\SyllabusCategory;
use App\Models\SyllabusTechnique;
use Filament\Widgets\Widget;

class AcademySyllabusWidget extends Widget
{
    public ?\App\Models\Academy $record = null;

    protected static string $view = 'filament.resources.academy-resource.widgets.syllabus-widget';

    protected function getViewData(): array
    {
        $academyId = $this->record->id;
        $categories = SyllabusCategory::where('academy_id', $academyId)->get();
        $techniques = SyllabusTechnique::where('academy_id', $academyId)->get();
        return [
            'categories' => $categories,
            'techniques' => $techniques,
        ];
    }
}
