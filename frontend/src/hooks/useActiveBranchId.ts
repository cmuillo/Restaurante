import { useAuthStore } from '../stores/auth.store';
import { useBranchStore } from '../stores/branch.store';

/**
 * Returns the effective branchId for the current user.
 * - SUPER_ADMIN: uses the branch selected globally in AdminLayout (from branch.store).
 * - Other roles: uses the branchId from their own user profile.
 */
export function useActiveBranchId(): string {
  const { user } = useAuthStore();
  const { activeBranchId } = useBranchStore();

  if (user?.role === 'super_admin') {
    return activeBranchId;
  }

  return user?.branchId ?? '';
}
