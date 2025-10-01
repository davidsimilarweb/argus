import axios from 'axios';

// In development, use the Vite proxy (relative URL)
// In production, use the full API URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// Device types
export interface Device {
  id: string;
  internalSerial: string;
  deviceId?: number;
  staticIp?: string;
  deviceType: 'iphone' | 'ipad';
  model?: string;
  iosVersion?: string;
  currentStatus: 'deployed' | 'standby' | 'broken' | 'testing';
  currentHostId?: string;
  currentAccountId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  currentHost?: Host;
  currentAccount?: Account;
}

export interface Account {
  id: string;
  appleId: string;
  country?: string;
  status: 'active' | 'locked' | 'disabled';
  password?: string;
  twoFactor?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Host {
  id: string;
  name: string;
  hostname?: string;
  status: 'online' | 'offline' | 'maintenance';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// API methods
export const deviceApi = {
  getAll: () => api.get<ApiResponse<Device[]>>('/devices'),
  getById: (id: string) => api.get<ApiResponse<Device>>(`/devices/${id}`),
  create: (data: Partial<Device>) => api.post<ApiResponse<Device>>('/devices', data),
  update: (id: string, data: Partial<Device>) => api.patch<ApiResponse<Device>>(`/devices/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/devices/${id}`),
  getHistory: (id: string) => api.get<ApiResponse<any>>(`/devices/${id}/history`),
  assignAccount: (id: string, accountId: string, notes?: string) =>
    api.post<ApiResponse<Device>>(`/devices/${id}/assign-account`, { accountId, notes }),
  unassignAccount: (id: string) =>
    api.post<ApiResponse<Device>>(`/devices/${id}/unassign-account`),
  assignHost: (id: string, hostId: string, notes?: string) =>
    api.post<ApiResponse<Device>>(`/devices/${id}/assign-host`, { hostId, notes }),
  unassignHost: (id: string) =>
    api.post<ApiResponse<Device>>(`/devices/${id}/unassign-host`),
  changeStatus: (id: string, status: Device['currentStatus'], changedBy?: string, notes?: string) =>
    api.post<ApiResponse<Device>>(`/devices/${id}/change-status`, { status, changedBy, notes }),
  addMaintenance: (id: string, data: {
    eventType: 'battery_replacement' | 'screen_repair' | 'other';
    description: string;
    performedBy?: string;
    cost?: number;
  }) => api.post<ApiResponse<any>>(`/devices/${id}/maintenance`, data),
};

export const accountApi = {
  getAll: () => api.get<ApiResponse<Account[]>>('/accounts'),
  getById: (id: string) => api.get<ApiResponse<Account>>(`/accounts/${id}`),
  create: (data: Partial<Account>) => api.post<ApiResponse<Account>>('/accounts', data),
  update: (id: string, data: Partial<Account>) => api.patch<ApiResponse<Account>>(`/accounts/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/accounts/${id}`),
};

export const hostApi = {
  getAll: () => api.get<ApiResponse<Host[]>>('/hosts'),
  getById: (id: string) => api.get<ApiResponse<Host>>(`/hosts/${id}`),
  create: (data: Partial<Host>) => api.post<ApiResponse<Host>>('/hosts', data),
  update: (id: string, data: Partial<Host>) => api.patch<ApiResponse<Host>>(`/hosts/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/hosts/${id}`),
  getDevices: (id: string) => api.get<ApiResponse<Device[]>>(`/hosts/${id}/devices`),
};