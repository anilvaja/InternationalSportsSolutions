# Sports Solutions SaaS Development Plan

## Project Overview
Multi-tenant Sports Academy Management System with Laravel + Filament

## Architecture
- **Central Panel**: Super Admin manages all academies
- **Tenant Panel**: Each academy manages their own data
- **Multi-tenancy**: Using Stancl/Tenancy package
- **Admin Panel**: Filament v3 for both central and tenant panels

## Phase 1: Foundation Setup ✅
- [x] Install tenancy and permission packages
- [x] Create Academy model (tenant)
- [x] Update User model for multi-tenancy
- [x] Create core tenant models (Branch, Student, Coach, etc.)

## Phase 2: Database Structure (In Progress)
### Central Database Tables:
- academies (tenants)
- users (central users + academy associations)
- domains
- tenant_*

### Tenant Database Tables (per academy):
- users (academy users)
- roles
- permissions
- branches
- students
- coaches
- syllabus_categories
- syllabus_techniques
- batches
- attendances
- events
- model_has_permissions
- model_has_roles
- role_has_permissions

## Phase 3: Models & Relationships
### Central Models:
- Academy (tenant)
- User (central)

### Tenant Models:
- User (tenant-specific)
- Branch
- Student
- Coach
- SyllabusCategory
- SyllabusTechnique
- Batch
- Attendance
- Event

## Phase 4: Filament Panels
### Central Panel (Super Admin):
- Academy Management
- User Management (academy owners)
- Subscription Management
- Analytics Dashboard

### Tenant Panel (Academy):
- Dashboard
- Branch Management
- Student Management
- Coach Management
- Batch Management
- Syllabus Management
- Attendance Tracking
- Event Management
- User & Role Management

## Phase 5: Security & Permissions
- Role-based access control
- Academy-level data isolation
- Subscription limits enforcement
- API rate limiting

## Phase 6: Advanced Features
- Multi-domain support
- File/media management
- Notifications
- Reports & Analytics
- Mobile API

## Current Status: Phase 2 - Database Structure
### Completed:
- Academy migration ✅
- User table updates ✅
- Branch migration ✅

### Next Steps:
1. Complete all model migrations
2. Set up model relationships
3. Configure tenant database migration system
4. Create Filament resources

## Key Requirements by Entity:

### Academy (Tenant):
- Multi-tenant isolation
- Subscription limits
- Domain/subdomain support
- Settings management

### Users:
- Central users (super admin)
- Tenant users (academy staff)
- Role-based permissions
- Academy association

### Students:
- Personal information
- Medical information
- Emergency contacts
- Progress tracking
- Payment history

### Coaches:
- Qualifications
- Specializations
- Schedule management
- Performance metrics

### Branches:
- Location management
- Facility details
- Manager assignment
- Capacity management

### Batches:
- Schedule management
- Student enrollment
- Coach assignment
- Capacity limits

### Syllabus:
- Hierarchical categories
- Technique management
- Sort ordering
- Progress tracking

### Attendance:
- Date/time tracking
- Student presence
- Make-up classes
- Reporting

### Events:
- Tournament management
- Training camps
- Special events
- Registration management

## Next Action Items:
1. Complete Student migration structure
2. Complete Coach migration structure
3. Set up all model relationships
4. Configure tenant migrations
5. Create Filament central panel
6. Create Filament tenant panel
