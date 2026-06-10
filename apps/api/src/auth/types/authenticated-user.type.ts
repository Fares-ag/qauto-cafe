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
  role: string;
  firstName: string;
  lastName: string;
  terminalId?: string;
  branchId?: string;
}
