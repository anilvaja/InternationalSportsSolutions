<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Branch;
use App\Models\Academy;

class BranchSeeder2 extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $academy = Academy::first();
        
        if (!$academy) {
            $this->command->error('No academy found. Please run AcademySeeder first.');
            return;
        }

        $branches = [
            [
                'name' => 'Ahmedabad Main Branch',
                'code' => 'AHM-MAIN',
                'address' => '12, Sardar Patel Stadium Complex',
                'city' => 'Ahmedabad',
                'state' => 'Gujarat',
                'postal_code' => '380009',
                'academy_id' => $academy->id,
            ],
            [
                'name' => 'Vadodara Branch',
                'code' => 'VAD',
                'address' => '23, Heritage Sports Complex',
                'city' => 'Vadodara',
                'state' => 'Gujarat',
                'postal_code' => '390001',
                'academy_id' => $academy->id,
            ],
            [
                'name' => 'Surat Branch',
                'code' => 'SUR',
                'address' => '45, Diamond Sports Center',
                'city' => 'Surat',
                'state' => 'Gujarat',
                'postal_code' => '395001',
                'academy_id' => $academy->id,
            ],
            [
                'name' => 'Rajkot Branch',
                'code' => 'RAJ',
                'address' => '67, Saurashtra Sports Complex',
                'city' => 'Rajkot',
                'state' => 'Gujarat',
                'postal_code' => '360001',
                'academy_id' => $academy->id,
            ],
            [
                'name' => 'Bhavnagar Branch',
                'code' => 'BHV',
                'address' => '89, Ganga Sports Ground',
                'city' => 'Bhavnagar',
                'state' => 'Gujarat',
                'postal_code' => '364001',
                'academy_id' => $academy->id,
            ],
            [
                'name' => 'Gandhinagar Branch',
                'code' => 'GAN',
                'address' => '34, Capital Sports Arena',
                'city' => 'Gandhinagar',
                'state' => 'Gujarat',
                'postal_code' => '382010',
                'academy_id' => $academy->id,
            ],
            [
                'name' => 'Jamnagar Branch',
                'code' => 'JAM',
                'address' => '56, Coastal Sports Center',
                'city' => 'Jamnagar',
                'state' => 'Gujarat',
                'postal_code' => '361001',
                'academy_id' => $academy->id,
            ]
        ];

        foreach ($branches as $branchData) {
            Branch::firstOrCreate(
                [
                    'name' => $branchData['name'],
                    'academy_id' => $branchData['academy_id']
                ],
                $branchData
            );
        }

        $this->command->info('Branch seeder completed successfully.');
    }
}
