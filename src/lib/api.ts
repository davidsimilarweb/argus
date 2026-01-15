import axios from 'axios';

// API configuration for the new Argus backend
// Uses relative URL to go through the proxy (avoids CORS issues)
const API_BASE_URL = '/argus';

// Get the auth token from environment only (.env / Vite env injection)
const getAuthToken = (): string => {
  return import.meta.env.VITE_ARGUS_TOKEN || '';
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth header interceptor
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers['X-Token'] = token;
  }
  return config;
});

// Enums matching the backend
export type DeviceType = 'iPhone' | 'iPad';
export type DeviceStatus = 'pending' | 'ready' | 'deployed' | 'broken' | 'testing' | 'lab_support';
export type ChangeType = 'created' | 'status' | 'account' | 'ios_version' | 'device_model' | 'notes' | 'other';

// Metadata type - flexible JSON object for extensibility
export type DeviceMetadata = Record<string, unknown>;

// Device types matching the new API
export interface Device {
  id: string; // Device serial (e.g., "ARG-001")
  device_type: DeviceType;
  device_model: string | null;
  ios_version: string | null;
  static_ip: string | null;
  current_status: DeviceStatus;
  current_account_id: string | null;
  notes: string | null;
  extra_data: DeviceMetadata | null;
  created_at: string;
  updated_at: string;
  account: Account | null;
}

// Account types matching the new API
export interface Account {
  id: string; // Apple ID (email)
  country: string | null;
  password: string | null;
  two_factor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  devices?: DeviceSummary[] | null; // Only when include_devices=true
}

// Device summary for nested account responses
export interface DeviceSummary {
  id: string;
  device_type: DeviceType;
  device_model: string | null;
  ios_version: string | null;
  static_ip: string | null;
  current_status: DeviceStatus;
  notes: string | null;
  extra_data: DeviceMetadata | null;
  created_at: string;
  updated_at: string;
}

// History types
export interface HistoryEntry {
  id: string;
  change_type: ChangeType;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
}

export interface DeviceHistory {
  // Backend returns `id` per latest spec; keep `device_id` optional for backward compatibility
  id?: string;
  device_id?: string;
  history: HistoryEntry[];
}

// Request types
export interface CreateDeviceRequest {
  id: string; // Required - device serial
  device_type: DeviceType;
  device_model?: string | null;
  ios_version?: string | null;
  static_ip?: string | null;
  current_status?: DeviceStatus; // Defaults to 'pending'
  current_account_id?: string | null;
  notes?: string | null;
  extra_data?: DeviceMetadata | null;
}

export interface UpdateDeviceRequest {
  device_type?: DeviceType | null;
  device_model?: string | null;
  ios_version?: string | null;
  static_ip?: string | null;
  current_status?: DeviceStatus | null;
  current_account_id?: string | null;
  notes?: string | null;
  extra_data?: DeviceMetadata | null;
}

export interface CreateAccountRequest {
  id: string; // Required - Apple ID
  country?: string | null;
  password?: string | null;
  two_factor?: string | null;
  notes?: string | null;
}

export interface UpdateAccountRequest {
  country?: string | null;
  password?: string | null;
  two_factor?: string | null;
  notes?: string | null;
}

// API methods for devices
export const deviceApi = {
  getAll: () => api.get<Device[]>('/devices'),
  getById: (deviceId: string) => api.get<Device>(`/devices/${encodeURIComponent(deviceId)}`),
  getHistory: (deviceId: string) => api.get<DeviceHistory>(`/devices/${encodeURIComponent(deviceId)}/history`),
  create: (data: CreateDeviceRequest) => api.post<Device>('/devices', data),
  update: (deviceId: string, data: UpdateDeviceRequest) => 
    api.put<Device>(`/devices/${encodeURIComponent(deviceId)}`, data),
  delete: (deviceId: string) => api.delete<Device>(`/devices/${encodeURIComponent(deviceId)}`),
};

// API methods for accounts
export const accountApi = {
  getAll: () => api.get<Account[]>('/accounts'),
  getById: (accountId: string, includeDevices = false) => 
    api.get<Account>(`/accounts/${encodeURIComponent(accountId)}`, {
      params: includeDevices ? { include_devices: true } : undefined,
    }),
  create: (data: CreateAccountRequest) => api.post<Account>('/accounts', data),
  update: (accountId: string, data: UpdateAccountRequest) => 
    api.put<Account>(`/accounts/${encodeURIComponent(accountId)}`, data),
  delete: (accountId: string) => api.delete<Account>(`/accounts/${encodeURIComponent(accountId)}`),
};
