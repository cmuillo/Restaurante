import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Guard que asegura que un usuario sólo acceda a datos de su propia sucursal.
 * Los super_admin pueden acceder a cualquier sucursal.
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No autenticado');
    }

    // super_admin puede ver todas las sucursales
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Para otros roles, se valida el branchId del params/query/body
    const requestedBranchId =
      request.params?.branchId ||
      request.query?.branchId ||
      request.body?.branchId;

    if (requestedBranchId && requestedBranchId !== user.branchId) {
      throw new ForbiddenException('No tienes acceso a esta sucursal');
    }

    // Inyectar branchId del usuario en el request para uso en servicios
    request.userBranchId = user.branchId;

    return true;
  }
}
