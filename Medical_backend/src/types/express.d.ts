import type { UserType } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      userType: UserType;
      vendorId?: string | null;
      retailerId?: string | null;
      customerId?: string | null;
      permissions: string[];
    }

    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export {};
