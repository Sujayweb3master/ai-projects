/**
 * Public representation of a user. Never includes the password hash.
 * @param {{ id: string, email: string, name: string, role: string, isActive: boolean, createdAt: Date, updatedAt: Date }} user
 */
export const toUserDto = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
