---
name: ui-testing-agent
description: Automated UI and Filament panel testing agent to inspect, render, validate, and verify web application interfaces across Admin, Academy, and Student portals.
---

# UI Testing Agent Instructions

This agent skill automates End-to-End and visual component UI testing for the application across all 3 Filament Panels (Admin, Academy, Student) and public views.

## UI Impact Detection & Visual Verification Capabilities

1. **Visual Element & Component Inspection**:
   - Analyzes rendered HTML/DOM structure for buttons, inputs, form fields, cards, brand headers, and Livewire components.
   - Detects UI element count drops (e.g. missing action buttons, absent form inputs, hidden navigation cards).
   - Flag broken Blade syntax, unrendered tags, missing CSS styles, and PHP runtime exceptions (`ParseError`, `ErrorException`).

2. **Live Browser Captures & Video Artifacts**:
   - Uses `browser_subagent` to launch real headless browser sessions on local dev servers (`http://127.0.0.1:8000/admin`, `/academy`, `/student`).
   - Automatically records WebP videos and screenshots of visual UI state transitions (e.g. form filling, modal popups, table sorting).

3. **Authentication & Multi-Panel Access Checks**:
   - Asserts Super Admin UI access at `/admin`.
   - Asserts Academy Admin, Manager, Coach, and Staff UI rendering at `/academy`.
   - Asserts Student Portal access at `/student`.

4. **Automated Diagnostic Execution**:
   - Run `php scripts/ui_test_runner.php` for instant UI component inspection and status summary.
   - Run `php artisan test --filter=UiPanelTestingTest` for automated feature assertions.

## Workflow Instructions

When invoked to verify UI changes or assess UI impact:

1. **Execute Visual UI Diagnostic Runner**:
   ```bash
   php scripts/ui_test_runner.php
   ```
2. **Execute Feature UI Assertions**:
   ```bash
   php artisan test --filter=UiPanelTestingTest
   ```
3. **Capture Browser Screenshots/Videos (if visual feedback requested)**:
   - Launch `browser_subagent` to capture visual animations and recordings of modified views.
4. **Report Detailed UI Impact Summary**:
   - Report HTTP status codes and active permissions.
   - Report total rendered UI elements (buttons, inputs, forms, components).
   - Report any missing or broken UI elements identified before declaring the task complete.
