import { Injectable } from '@nestjs/common';
import {
  HouseholdMemberRole,
  MODULE_KEYS,
  ModuleKey,
  PermissionAction,
  PermissionSet
} from '@homeapp/shared-types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly database: DatabaseService) {}

  async hasPermission(
    householdMemberId: string,
    moduleKey: ModuleKey,
    action: PermissionAction
  ): Promise<boolean> {
    const result = await this.database.query<PermissionRow>(
      `
        select
          can_read,
          can_create,
          can_update,
          can_delete
        from member_permissions
        where household_member_id = $1
          and module_key = $2
        limit 1
      `,
      [householdMemberId, moduleKey]
    );

    const row = result.rows[0];

    if (!row) {
      return false;
    }

    switch (action) {
      case 'read':
        return row.can_read;
      case 'create':
        return row.can_create;
      case 'update':
        return row.can_update;
      case 'delete':
        return row.can_delete;
    }
  }

  async listEffectivePermissions(
    householdMemberId: string,
    role: HouseholdMemberRole
  ): Promise<PermissionSet[]> {
    if (role === 'owner') {
      return MODULE_KEYS.map((moduleKey) => ({
        canCreate: true,
        canDelete: true,
        canRead: true,
        canUpdate: true,
        moduleKey
      }));
    }

    const result = await this.database.query<PermissionWithModuleRow>(
      `
        select
          module_key,
          can_read,
          can_create,
          can_update,
          can_delete
        from member_permissions
        where household_member_id = $1
      `,
      [householdMemberId]
    );
    const permissionsByModule = new Map(
      result.rows.map((row) => [
        row.module_key,
        {
          canCreate: row.can_create,
          canDelete: row.can_delete,
          canRead: row.can_read,
          canUpdate: row.can_update,
          moduleKey: row.module_key
        }
      ])
    );

    return MODULE_KEYS.map(
      (moduleKey) =>
        permissionsByModule.get(moduleKey) ?? {
          canCreate: false,
          canDelete: false,
          canRead: false,
          canUpdate: false,
          moduleKey
        }
    );
  }

  async listEffectivePermissionsForHouseholdMember(
    householdId: string,
    householdMemberId: string
  ): Promise<PermissionSet[] | null> {
    const member = await this.database.query<{ id: string; role: HouseholdMemberRole }>(
      `
        select id, role
        from household_members
        where household_id = $1
          and id = $2
          and is_active = true
        limit 1
      `,
      [householdId, householdMemberId]
    );
    const row = member.rows[0];

    if (!row) {
      return null;
    }

    return this.listEffectivePermissions(row.id, row.role);
  }
}

interface PermissionRow {
  can_create: boolean;
  can_delete: boolean;
  can_read: boolean;
  can_update: boolean;
}

interface PermissionWithModuleRow extends PermissionRow {
  module_key: ModuleKey;
}
