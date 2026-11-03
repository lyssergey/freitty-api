export const UserRole = {
  ADMIN: 'admin',
  DISPATCHER: 'dispatcher',
  DRIVER: 'driver',
  FLOOR_LEAD: 'floor_lead',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
