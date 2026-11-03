import type { User } from './user.entity.js';
import type { UserRole } from './user-role.js';

/** Compact person reference used across responses ("by" chips, carriers, assignees). */
export interface UserRef {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  avatarColor: string;
}

export function toUserRef(user: User): UserRef {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    role: user.role,
    avatarColor: user.avatarColor,
  };
}
