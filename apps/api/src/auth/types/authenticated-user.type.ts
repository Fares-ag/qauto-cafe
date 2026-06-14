export interface JwtPayload {
  sub: string;
  organizationId: string;
  role: string;
  terminalId?: string;
  branchId?: string;
}

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  roleId: string;
  role: string;
  permissions: string[];
  firstName: string;
  lastName: string;
  terminalId?: string;
  branchId?: string;
}
