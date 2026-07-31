---
name: application-development-agent
description: Agentic application development assistant for the multi-tenant SaaS app that understands current features, repo conventions, and development best practices.
---

# Application Development Agent Instructions

This agent skill is designed to help develop, extend, and maintain the current Laravel 12 + Filament 3 multi-tenant SaaS application.

## Purpose

- Review the existing repository and feature set before generating code.
- Use repository conventions from `app/Filament`, `routes`, `resources/views`, `config`, and existing tests.
- Maintain multi-tenancy, authorization, and UI consistency across `/admin`, `/academy`, and `/student` panels.
- Ask clarifying questions for vague requirements and avoid assumptions.

## Agent Workflow

1. **Understand the task**:
   - Identify the affected application area (System Settings, Tenancy, Filament resources, Fees, Attendance, Leaves, Pharmacy, Rooms, Student Portal, etc.).
   - Review related models, policies, permissions, UI pages, and tests.
2. **Plan the work**:
   - Break the task into concrete implementation steps.
   - Choose the smallest safe change set to complete the feature.
   - Identify required migrations, models, controllers, Filament resources, views, and tests.
3. **Implement with conventions**:
   - Follow existing Laravel conventions, Filament patterns, tenant isolation, and guard logic.
   - Reuse service classes, form components, Livewire flows, and media handling where appropriate.
4. **Validate changes**:
   - Run `php artisan test` and targeted tests for the changed feature.
   - If UI-related, invoke the `ui-testing-agent` and run:
     - `php artisan test --filter=UiPanelTestingTest`
     - `php scripts/ui_test_runner.php`
   - Confirm no regressions in admin, academy, and student panels.
5. **Document and report**:
   - List any assumptions or open questions.
   - Summarize code changes, files touched, and validation results.

## Prompting Guidelines

- Use explicit, task-focused prompts like:
  - "Implement feature X for the Academy panel using the existing Filament patterns."
  - "Add validation and UI tests for fee installment creation in the current system."
- If requirements are incomplete, ask:
  - "What user roles should be able to perform this action?"
  - "Does this change apply to all tenants or only a specific academy type?"
- Prefer incremental improvements over large rewrites.

## Best Practices

- Preserve the existing tenant-aware `stancl/tenancy` workflow.
- Respect `spatie/laravel-permission` and tenant-specific role assignments.
- Keep system settings and branding changes consistent across all panels.
- Add or update tests for every new or changed behavior.
- Avoid breaking the public landing page and cross-panel access logic.

## Integration with Workspace Rules

- For any UI or Filament resource work, coordinate with the `ui-testing-agent`.
- Use existing diagnostics and tests before marking work complete.
- When adding a new feature, include documentation or update relevant docs if appropriate.
