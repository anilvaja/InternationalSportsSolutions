<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;

class InterestedStudentsExport implements FromArray, WithHeadings, WithMapping, WithStyles, WithTitle, WithColumnWidths
{
    protected $event;
    protected $participants;

    public function __construct($event, $participants)
    {
        $this->event = $event;
        $this->participants = $participants;
    }

    public function array(): array
    {
        return $this->participants->toArray();
    }

    public function headings(): array
    {
        return [
            'Student ID',
            'Student Name',
            'Email',
            'Phone',
            'Belt Level',
            'Age',
            'Gender',
            'Branch',
            'Response Date',
            'Response Notes',
            'Payment Status',
            'Payment Required',
            'Fee Amount'
        ];
    }

    public function map($participant): array
    {
        $student = $participant['student'] ?? null;
        
        return [
            $student['student_id'] ?? 'N/A',
            $student['name'] ?? 'N/A',
            $student['email'] ?? 'N/A',
            $student['phone'] ?? 'N/A',
            $student['belt_level'] ?? 'N/A',
            $student['age'] ?? 'N/A',
            ucfirst($student['gender'] ?? 'N/A'),
            $student['branch']['name'] ?? 'N/A',
            $participant['responded_at'] ? date('Y-m-d H:i', strtotime($participant['responded_at'])) : 'N/A',
            $participant['response_notes'] ?? 'N/A',
            ucfirst($participant['payment_status'] ?? 'pending'),
            $participant['payment_required'] ? 'Yes' : 'No',
            $this->event->fee > 0 ? '₹' . number_format($this->event->fee, 2) : 'Free'
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            // Style the header row
            1 => [
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => 'FFFFFF'],
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '2563eb'],
                ],
            ],
            // Add borders to all cells
            'A1:M' . ($this->participants->count() + 1) => [
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN,
                        'color' => ['rgb' => 'DDDDDD'],
                    ],
                ],
            ],
        ];
    }

    public function title(): string
    {
        return 'Interested Students - ' . substr($this->event->title, 0, 20);
    }

    public function columnWidths(): array
    {
        return [
            'A' => 12, // Student ID
            'B' => 25, // Student Name
            'C' => 30, // Email
            'D' => 15, // Phone
            'E' => 12, // Belt Level
            'F' => 8,  // Age
            'G' => 10, // Gender
            'H' => 20, // Branch
            'I' => 18, // Response Date
            'J' => 25, // Response Notes
            'K' => 15, // Payment Status
            'L' => 15, // Payment Required
            'M' => 12, // Fee Amount
        ];
    }
}
