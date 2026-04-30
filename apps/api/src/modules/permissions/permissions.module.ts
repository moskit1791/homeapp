import { Module } from '@nestjs/common';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionsService } from './permissions.service';

@Module({
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard]
})
export class PermissionsModule {}
