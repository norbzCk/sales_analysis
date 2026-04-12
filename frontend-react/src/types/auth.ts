export type UserRole = "user" | "seller" | "admin" | "super_admin" | "owner" | "logistics" | "";

export type UserType = "user" | "business" | "logistics" | "";

export interface SessionUser {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  role?: UserRole | string;
  business_name?: string;
  owner_name?: string;
}

export interface AuthResponse {
  access_token: string;
  user: SessionUser;
}
