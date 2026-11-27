export type UserRole = 'employee' | 'admin';

export interface UserProfile {
  id: string;
  personal_email: string;
  employee_id: string | null;
  role: UserRole;
  full_name?: string;
  phone_number?: string;
}

export type CabRequestType = 'ADD' | 'UPDATE' | 'REMOVE';

export type RouteArea = 'SAR 2' | 'SAR 3';

export interface UnapprovedCab {
  id: number | string;
  cab_number: string; // 4-digit string
  driver_name?: string | null;
  driver_number: string; // 10-digit phone
  old_driver_number?: string | null; // Original phone number when updating wrong number
  request_type: CabRequestType;
  requested_by: string;
  requested_by_email?: string;
  created_at: string;
  vehicle_model?: string;
  route_area?: RouteArea | string;
  notes?: string | null;
}

export interface FinalCab {
  id: string;
  cab_number: string; // 4-digit string
  driver_name?: string | null;
  driver_number: string;
  updated_at: string;
  vehicle_model?: string;
  route_area?: RouteArea | string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
