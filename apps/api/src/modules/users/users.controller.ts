import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsBoolean, IsIn } from 'class-validator';
import { Permission, UserRoleName } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { CurrentPrincipal, RequirePermission } from '../access/access.decorators';
import { Audited } from '../audit/audit.decorators';
import { UserAdminService } from './user-admin.service';

export class ChangeRoleDto {
  @IsIn(Object.values(UserRoleName))
  role!: string;
}

export class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

/**
 * User & role administration (Phase 5, Task 20) — admin only (user:manage).
 */
@Controller('users')
@RequirePermission(Permission.USER_MANAGE)
export class UsersController {
  constructor(private readonly users: UserAdminService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get('roles')
  roles() {
    return this.users.roleMatrix();
  }

  @Patch(':id/role')
  @Audited({ action: 'user.role_change', resourceType: 'User', idParam: 'id' })
  changeRole(@CurrentPrincipal() actor: Principal, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.users.changeRole(actor, id, dto.role);
  }

  @Patch(':id/active')
  @Audited({ action: 'user.access_change', resourceType: 'User', idParam: 'id' })
  setActive(@CurrentPrincipal() actor: Principal, @Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.users.setActive(actor, id, dto.isActive);
  }
}
