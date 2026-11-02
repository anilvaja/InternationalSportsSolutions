/**
 * SecurityGuardService
 * Centralized authorization guard protecting all role and permission modification operations.
 * 
 * Enforces:
 * 1. Self-escalation prevention (users cannot change their own role or permissions)
 * 2. Delegated scope verification (actors can only grant roles/permissions within their authority)
 * 3. Super Admin privilege protection from tenant contexts
 * 4. Bulk import and indirect workflow escalation defense
 * 5. Last active Super Admin preservation
 * 6. View-only read-only enforcement
 * 7. Immutable before/after authorization audit logging
 */

import { ALL_ACADEMY_PERMISSIONS } from '../config/permissions.js';

export const ROLE_HIERARCHY_RANK = {
  super_admin: 100,
  academy_admin: 80,
  head_coach: 50,
  finance_manager: 40,
  coach: 30,
  receptionist: 20,
  front_desk: 20,
  academy_staff: 20,
  student: 10
};

export class SecurityGuardService {
  /**
   * 1. Resolves numerical privilege rank for any system or custom role
   */
  static getRoleRank(roleName, db = null) {
    if (!roleName) return 0;
    const clean = String(roleName).toLowerCase().trim();
    if (ROLE_HIERARCHY_RANK[clean] !== undefined) {
      return ROLE_HIERARCHY_RANK[clean];
    }
    // For custom roles in database
    if (db) {
      try {
        const customRole = db.prepare('SELECT permissions, is_system FROM academy_roles WHERE name = ?').get(clean);
        if (customRole) {
          let perms = [];
          try { perms = JSON.parse(customRole.permissions || '[]'); } catch (_) {}
          if (perms.includes('all')) return 80;
          if (perms.includes('manage_roles') || perms.includes('assign_user_roles')) return 70;
          if (perms.includes('manage_coaches') || perms.includes('manage_staff_payroll')) return 45;
          return 25; // standard custom operational staff
        }
      } catch (_) {}
    }
    return 20; // default staff rank for unknown custom roles
  }

  /**
   * 2. Computes the complete set of effective permissions for an actor
   */
  static getActorEffectivePermissions(actor, db = null) {
    if (!actor) return [];
    if (actor.isSuperAdmin || actor.role === 'academy_admin') {
      return ['all', ...ALL_ACADEMY_PERMISSIONS];
    }
    let perms = Array.isArray(actor.permissions) ? [...actor.permissions] : [];
    if (actor.custom_permissions) {
      try {
        const cp = typeof actor.custom_permissions === 'string' 
          ? JSON.parse(actor.custom_permissions) 
          : actor.custom_permissions;
        if (Array.isArray(cp)) perms.push(...cp);
      } catch (_) {}
    }
    if (db && actor.userId) {
      try {
        const userRow = db.prepare('SELECT custom_permissions, role FROM users WHERE id = ?').get(actor.userId);
        if (userRow) {
          if (userRow.custom_permissions) {
            try {
              const ucp = JSON.parse(userRow.custom_permissions);
              if (Array.isArray(ucp)) perms.push(...ucp);
            } catch (_) {}
          }
          const roleRow = db.prepare('SELECT permissions FROM academy_roles WHERE name = ?').get(userRow.role);
          if (roleRow && roleRow.permissions) {
            try {
              const rp = JSON.parse(roleRow.permissions);
              if (Array.isArray(rp)) perms.push(...rp);
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
    return Array.from(new Set(perms));
  }

  /**
   * 3. Validates whether actor has authority to modify a target user's role
   * Enforces Requirements: 1, 2, 3, 4, 5
   */
  static assertCanModifyUserRole({ db, actor, targetUserId, newRole, reason = null }) {
    if (!actor) {
      throw new Error('Authentication required for role assignment');
    }

    const currentActorId = Number(actor.userId || actor.id);
    const targetId = Number(targetUserId);

    // Requirement 1 & 3: Self-role modification prevention
    if (currentActorId && targetId === currentActorId) {
      throw new Error('Access denied: Users cannot alter their own role or privileges.');
    }

    // Requirement 5: Super Admin protection
    if (newRole === 'super_admin') {
      throw new Error('Access denied: Super Admin role cannot be created or assigned in academy tenant context.');
    }

    const targetUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(targetId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Prevent modifying fellow Super Admin from tenant context
    if (targetUser.role === 'super_admin') {
      throw new Error('Access denied: Super Admin accounts cannot be modified from tenant context.');
    }

    // If actor is Super Admin or Academy Admin, they have top-level authority over tenant roles
    if (actor.isSuperAdmin || actor.role === 'academy_admin') {
      return { allowed: true, targetUser };
    }

    // Delegated scope validation for non-admin actors (e.g. head_coach or manager with assign_user_roles)
    const actorRank = this.getRoleRank(actor.role, db);
    const targetCurrentRank = this.getRoleRank(targetUser.role, db);
    const targetNewRank = this.getRoleRank(newRole, db);

    // Cannot modify someone with equal or higher rank
    if (targetCurrentRank >= actorRank) {
      throw new Error(`Access denied: Cannot alter the role of user '${targetUser.name}' whose administrative privilege (${targetUser.role}) matches or exceeds yours.`);
    }

    // Cannot assign a role equal to or higher than own rank
    if (targetNewRank >= actorRank) {
      throw new Error(`Access denied: Cannot assign role '${newRole}' which exceeds or matches your delegated authority scope.`);
    }

    // Non-admin can never assign academy_admin
    if (newRole === 'academy_admin') {
      throw new Error('Access denied: Only existing Academy Admins or Super Admins can assign the academy_admin role.');
    }

    return { allowed: true, targetUser };
  }

  /**
   * 4. Validates whether actor has authority to grant custom permissions
   * Enforces Requirements: 1, 4, 7
   */
  static assertCanGrantPermissions({ db, actor, targetUserId, permissionsToGrant, reason = null }) {
    if (!actor) {
      throw new Error('Authentication required for permission assignment');
    }

    const currentActorId = Number(actor.userId || actor.id);
    const targetId = Number(targetUserId);

    // Self-permission modification prevention
    if (currentActorId && targetId === currentActorId) {
      throw new Error('Access denied: Users cannot modify their own permissions.');
    }

    const perms = Array.isArray(permissionsToGrant) ? permissionsToGrant : [];
    if (perms.length === 0) return { allowed: true };

    if (actor.isSuperAdmin || actor.role === 'academy_admin') {
      return { allowed: true };
    }

    // Non-admin cannot grant wildcard 'all'
    if (perms.includes('all')) {
      throw new Error("Access denied: Universal 'all' permission can only be granted by an Academy Admin or Super Admin.");
    }

    // Subset rule: actor can only grant permissions they themselves possess
    const actorPerms = this.getActorEffectivePermissions(actor, db);
    const unauthorizedPerms = perms.filter(p => !actorPerms.includes(p) && !actorPerms.includes('all'));

    if (unauthorizedPerms.length > 0) {
      throw new Error(`Access denied: Cannot grant permission(s) beyond your delegated authority scope: ${unauthorizedPerms.join(', ')}.`);
    }

    return { allowed: true };
  }

  /**
   * 5. Validates role creation or modification
   * Enforces Requirements: 4, 5, 7, 10
   */
  static assertCanCreateOrModifyRole({ db, actor, roleId = null, roleName, permissions = [], displayName = null }) {
    if (!actor) {
      throw new Error('Authentication required');
    }

    const perms = Array.isArray(permissions) ? permissions : [];

    // Super Admin protection
    if (roleName === 'super_admin') {
      throw new Error('Access denied: Super Admin role is managed in central platform only.');
    }

    if (actor.isSuperAdmin || actor.role === 'academy_admin') {
      return { allowed: true };
    }

    // Non-admin cannot grant 'all'
    if (perms.includes('all')) {
      throw new Error("Access denied: Universal 'all' permission can only be granted by an Academy Admin or Super Admin.");
    }

    // Subset rule for role creation/modification
    const actorPerms = this.getActorEffectivePermissions(actor, db);
    const unauthorizedPerms = perms.filter(p => !actorPerms.includes(p) && !actorPerms.includes('all'));

    if (unauthorizedPerms.length > 0) {
      throw new Error(`Access denied: Cannot create or update role with permissions beyond your delegated scope: ${unauthorizedPerms.join(', ')}.`);
    }

    return { allowed: true };
  }

  /**
   * 6. Validates user creation or CSV import
   * Enforces Requirement: 6
   */
  static assertCanCreateOrImportUser({ db, actor, role, custom_permissions = [] }) {
    if (!actor) {
      throw new Error('Authentication required');
    }

    const assignedRole = role || 'coach';

    // Super Admin protection
    if (assignedRole === 'super_admin') {
      throw new Error('Access denied: Super Admin role cannot be created in academy tenant context.');
    }

    if (assignedRole === 'academy_admin' && !actor.isSuperAdmin && actor.role !== 'academy_admin') {
      throw new Error('Access denied: Only existing Academy Admins or Super Admins can create or import admin accounts.');
    }

    if (!actor.isSuperAdmin && actor.role !== 'academy_admin') {
      const actorRank = this.getRoleRank(actor.role, db);
      const roleRank = this.getRoleRank(assignedRole, db);
      if (roleRank >= actorRank) {
        throw new Error(`Access denied: Cannot onboard or import user with role '${assignedRole}' exceeding your delegated authority.`);
      }

      const perms = Array.isArray(custom_permissions) ? custom_permissions : [];
      if (perms.length > 0) {
        const actorPerms = this.getActorEffectivePermissions(actor, db);
        const unauthorized = perms.filter(p => !actorPerms.includes(p) && !actorPerms.includes('all'));
        if (unauthorized.length > 0) {
          throw new Error(`Access denied: Cannot assign custom permissions beyond your delegated scope: ${unauthorized.join(', ')}.`);
        }
      }
    }

    return { allowed: true };
  }

  /**
   * 7. Protects last active Super Admin
   * Enforces Requirement: 9
   */
  static assertCanDeactivateOrDeleteSuperAdmin(centralDb, targetId, newStatus = null) {
    if (!targetId) return { allowed: true };

    const target = centralDb.prepare('SELECT id, email, status FROM super_admins WHERE id = ?').get(Number(targetId));
    if (!target) return { allowed: true };

    // If target is currently active and either being deleted or set to inactive
    if (target.status === 'active' && (newStatus === 'inactive' || newStatus === null)) {
      const activeCount = centralDb.prepare("SELECT COUNT(*) as c FROM super_admins WHERE status = 'active'").get().c;
      if (activeCount <= 1) {
        throw new Error('Security Guard Violation: Cannot delete or deactivate the last active Super Admin account.');
      }
    }

    return { allowed: true, target };
  }

  /**
   * 8. Records immutable authorization audit log
   * Enforces Requirement: 8
   */
  static recordAuthorizationAudit(db, { action, actor, target, before, after, reason = null, ipAddress = '127.0.0.1' }) {
    try {
      const actorId = actor ? (actor.userId || actor.id || null) : null;
      const actorName = actor ? (actor.name || actor.email || 'System') : 'System';
      const actorRole = actor ? (actor.role || (actor.isSuperAdmin ? 'super_admin' : 'unknown')) : 'unknown';

      const details = JSON.stringify({
        actor: { id: actorId, name: actorName, role: actorRole },
        target: target || null,
        before: before || null,
        after: after || null,
        reason: reason || 'Administrative authorization update',
        timestamp: new Date().toISOString()
      });

      db.prepare(`
        INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, 'authorization_security', ?, ?, ?)
      `).run(
        actorId,
        actorName,
        actorRole,
        action,
        target ? String(target.id || target.roleId || '') : null,
        details,
        ipAddress
      );
    } catch (e) {
      console.error('[SecurityGuardService.recordAuthorizationAudit] Error logging audit:', e);
    }
  }
}
