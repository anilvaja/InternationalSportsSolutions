<?php

namespace App\Console\Commands;

use App\Models\Academy;
use Illuminate\Console\Command;

class EnsureAcademyDefaultRoles extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'academy:ensure-default-roles 
                            {--academy= : Specific academy ID to process}
                            {--check : Only check which academies are missing roles}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Ensure all academies have the 4 default roles (admin, manager, coach, staff)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $academyId = $this->option('academy');
        $checkOnly = $this->option('check');

        if ($academyId) {
            $academy = Academy::find($academyId);
            if (!$academy) {
                $this->error("Academy with ID {$academyId} not found.");
                return 1;
            }
            $academies = collect([$academy]);
        } else {
            $academies = Academy::all();
        }

        $this->info("Processing {$academies->count()} academy(ies)...");

        $processed = 0;
        $updated = 0;
        $alreadyComplete = 0;

        foreach ($academies as $academy) {
            $processed++;
            
            if ($academy->hasAllDefaultRoles()) {
                $alreadyComplete++;
                $this->line("✓ Academy '{$academy->name}' already has all default roles");
                continue;
            }

            if ($checkOnly) {
                $this->warn("⚠ Academy '{$academy->name}' is missing default roles");
                continue;
            }

            $rolesBeforeCount = $academy->roles()->where('is_default', true)->count();
            $academy->ensureDefaultRoles();
            $rolesAfterCount = $academy->roles()->where('is_default', true)->count();
            
            $created = $rolesAfterCount - $rolesBeforeCount;
            $updated++;

            if ($created > 0) {
                $this->info("✓ Academy '{$academy->name}' - Created {$created} default role(s)");
            } else {
                $this->info("✓ Academy '{$academy->name}' - All default roles confirmed");
            }
        }

        $this->newLine();
        
        if ($checkOnly) {
            $missing = $processed - $alreadyComplete;
            $this->info("Check completed:");
            $this->info("- {$alreadyComplete} academies have all default roles");
            $this->info("- {$missing} academies are missing default roles");
            
            if ($missing > 0) {
                $this->newLine();
                $this->info("Run without --check flag to create missing roles:");
                $this->comment("php artisan academy:ensure-default-roles");
            }
        } else {
            $this->info("Processing completed:");
            $this->info("- {$alreadyComplete} academies already had all default roles");
            $this->info("- {$updated} academies were updated with missing roles");
        }

        return 0;
    }
}
