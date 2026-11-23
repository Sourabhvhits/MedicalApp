export type UserType = 'CUSTOMER' | 'RETAILER' | 'VENDOR';

export interface AuthProfile {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone: string;
  userType: UserType;
  status: string;
  avatarUrl?: string | null;
  permissions: string[];
  vendorId?: string | null;
  retailerId?: string | null;
  customerId?: string | null;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserReducerState {
  user: AuthProfile | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
