# International Sports Solutions - SaaS Multi-Tenant System

## Project Overview
A comprehensive SaaS-based sports academy management system with multi-tenancy support, allowing multiple academies to manage their operations independently while maintaining centralized super admin control.

## Architecture Overview

### Multi-Tenancy Structure
- **Central Database**: Contains all academies and central user management
- **Tenant Databases**: Each academy has its own database for operational data
- **Super Admin Panel**: Manages all academies with restrictions
- **Academy Owner Panel**: Manages individual academy operations

## Core Models & Features

### 1. Academy (Central - Tenant Model)
**Purpose**: Represents each sports academy/tenant
**Key Features**:
- Subscription management
- Resource limitations (users, students, branches, coaches)
- Domain/subdomain support
- Academy-specific settings

**Database Fields**:
```php
- id, name, slug, description
- domain (for subdomain support)
- contact_email, contact_phone, address details
- status (active/inactive/suspended)
- settings (JSON for academy-specific configurations)
- max_users, max_students, max_branches, max_coaches
- subscription_starts_at, subscription_ends_at
```

### 2. User (Central Model with Academy Association)
**Purpose**: System users (super admin, academy owners, staff)
**Key Features**:
- Role-based permissions per academy
- Super admin capabilities
- Academy-specific access control

**Database Fields**:
```php
- Standard user fields + academy_id
- is_super_admin (boolean)
- phone, avatar, status
```

### 3. Branch (Tenant Model)
**Purpose**: Physical locations within an academy
**Key Features**:
- Multiple locations per academy
- Branch-specific operations
- Staff assignment

### 4. Student (Tenant Model)
**Purpose**: Students enrolled in the academy
**Key Features**:
- Complete student profiles
- Parent/guardian information
- Medical information tracking
- Multi-batch enrollment support

**Advanced Features**:
- Technique progress tracking per batch
- Attendance rate calculations
- Parent notifications

### 5. Coach (Tenant Model)
**Purpose**: Instructors and trainers
**Key Features**:
- Qualification tracking
- Specialization management
- Experience levels

### 6. Syllabus System (Tenant Models)

#### SyllabusCategory
- Hierarchical category system
- Custom ordering

#### SyllabusTechnique
- Individual techniques within categories
- Sort order for progression
- Difficulty levels
- Prerequisites support

### 7. Batch (Tenant Model)
**Purpose**: Class groups/sessions
**Key Features**:
- Time-based scheduling
- Capacity management
- Fee structure
- Coach assignment

### 8. Advanced Progress Tracking

#### StudentTechniqueProgress (Tenant Model)
**Purpose**: Detailed tracking of each student's technique learning
**Key Features**:
- Status tracking: not_started → learning → practiced → mastered
- Practice count increment
- Coach assessments
- Date tracking for started/completed

#### Batch-Student Pivot Enhancement
**Key Addition**: `last_technique_learned_id`
- Tracks the most recent technique learned in each batch
- Quick reference for current student position in syllabus
- Used for UI display in attendance marking

### 9. Attendance System (Tenant Model)
**Enhanced Features**:
- Technique focus tracking per class
- Automatic progress updates
- Parent notification system
- Make-up class management

**UI Integration with Techniques**:
When marking attendance, the system will:
1. Show all available techniques for selection
2. Allow marking the primary technique focused on during class
3. Automatically update student technique progress
4. Update the last_technique_learned_id in batch_student pivot

## Technical Implementation Plan

### Phase 1: Foundation ✅ (Current)
- [x] Multi-tenancy setup with Stancl/Tenancy
- [x] Permission system with Spatie/Permission
- [x] Core model structure
- [x] Database migrations
- [x] Advanced technique progress tracking

### Phase 2: Filament Admin Panels (Next)
- [ ] Central Super Admin Panel
- [ ] Academy Owner Panel
- [ ] Resource management with tenant scoping
- [ ] User management with role assignments

### Phase 3: Core Functionality
- [ ] Student enrollment system
- [ ] Batch management
- [ ] Attendance system with technique tracking
- [ ] Progress reporting

### Phase 4: Advanced Features
- [ ] Parent portal
- [ ] Notification system
- [ ] Payment integration
- [ ] Reports and analytics

### Phase 5: Mobile App Support
- [ ] API development
- [ ] Mobile app for coaches
- [ ] Parent mobile app

## Key Benefits of This Approach

### For Super Admin:
- Complete oversight of all academies
- Resource usage monitoring
- Subscription management
- Academy performance analytics

### For Academy Owners:
- Complete control over their academy operations
- Isolated data with security
- Custom configurations
- Scalable user/student limits

### For Coaches:
- Easy attendance marking with technique selection
- Automatic progress tracking
- Student performance insights
- Streamlined class management

### For Students/Parents:
- Detailed progress tracking
- Clear technique learning path
- Attendance history
- Performance analytics

## Database Design Highlights

### Technique Progress Flow:
1. **SyllabusCategory** → **SyllabusTechnique** (with sort_order)
2. **Student** enrolled in **Batch**
3. **Attendance** marked with primary_technique_focused_id
4. **StudentTechniqueProgress** automatically updated
5. **batch_student.last_technique_learned_id** updated
6. UI shows current technique position for each student

### Multi-Tenancy Benefits:
- Data isolation per academy
- Independent scaling
- Custom features per academy
- Secure multi-tenancy with domain support

## Next Steps

1. **Test Current Migrations** - Ensure all relationships work correctly
2. **Create Filament Resources** - Build admin interfaces
3. **Implement Tenant Switching** - Set up academy selection
4. **Build Attendance UI** - Create technique selection interface
5. **Add Progress Reports** - Student technique advancement reports

## Notes for Development
- All tenant models should include proper scoping
- Technique progress updates should be automatic via attendance
- UI should clearly show student's current technique position
- Parent notifications should be configurable per academy
- Resource limits should be enforced at the application level
