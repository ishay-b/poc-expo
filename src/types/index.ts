export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface User {
  id: string;
  name: string;
  badgeNumber: string;
  role: 'guard' | 'supervisor' | 'admin';
}

export interface Prisoner {
  id: string;
  name: string;
  cellNumber: string;
  status: 'active' | 'transferred' | 'released';
}

export interface Incident {
  id: string;
  reportedBy: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  resolved: boolean;
}
