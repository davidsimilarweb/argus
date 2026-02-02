import axios from 'axios';
import type { AxiosResponse } from 'axios';

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

// Separate client for internal crawler endpoints
const internalApi = axios.create({
  baseURL: '/internal',
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

internalApi.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers['X-Token'] = token;
  }
  return config;
});

// Enums matching the backend
export type DeviceType = 'iPhone' | 'iPad';
export type DeviceStatus = 'pending' | 'ready' | 'deployed' | 'broken' | 'testing' | 'lab_support';
export type ChangeType =
  | 'created'
  | 'status'
  | 'account_id'
  | 'ios_version'
  | 'device_model'
  | 'notes'
  | 'other';

// Metadata type - flexible JSON object for extensibility
export type DeviceMetadata = Record<string, unknown>;

// Device types matching the new API
export interface Device {
  id: string; // Device serial (e.g., "ARG-001")
  device_type: DeviceType;
  device_model: string | null;
  ios_version: string | null;
  static_ip: string | null;
  status: DeviceStatus;
  account_id: string | null;
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
  status: DeviceStatus;
  notes: string | null;
  extra_data: DeviceMetadata | null;
  created_at: string;
  updated_at: string;
}

// History types
export interface HistoryEntry {
  id: string;
  device_id: string;
  change_type: ChangeType;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
}

export interface DeviceHistory {
  id: string;
  history: HistoryEntry[];
}

// Health check / crawler logs
export interface CrawlerLog {
  log_ts: string;
  log_type: string;
  reason?: string | null;
  [key: string]: unknown;
}

export interface DeviceCrawlerLogs {
  device_id: string;
  logs: CrawlerLog[];
}

// Request types
export interface CreateDeviceRequest {
  id: string; // Required - device serial
  device_type: DeviceType;
  device_model?: string | null;
  ios_version?: string | null;
  static_ip?: string | null;
  status?: DeviceStatus; // Defaults to 'pending'
  account_id?: string | null;
  notes?: string | null;
  extra_data?: DeviceMetadata | null;
}

export interface UpdateDeviceRequest {
  device_type?: DeviceType | null;
  device_model?: string | null;
  ios_version?: string | null;
  static_ip?: string | null;
  status?: DeviceStatus | null;
  account_id?: string | null;
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

// Normalize backend responses in case some fields are omitted.
// We’ve seen cases where `account` is present but `account_id` is missing.
function normalizeDevice(raw: any): Device {
  const account = raw?.account ?? null;
  const account_id =
    raw?.account_id !== undefined
      ? raw.account_id
      : account?.id !== undefined
        ? account.id
        : null;

  return {
    ...raw,
    account,
    account_id,
  } as Device;
}

function normalizeAccount(raw: any): Account {
  const devices = Array.isArray(raw?.devices) ? raw.devices.map(normalizeDevice) : raw?.devices;
  return {
    ...raw,
    devices,
  } as Account;
}

// API methods for devices
export const deviceApi = {
  getAll: async () => {
    const res = await api.get<any[]>('/devices');
    return { ...res, data: res.data.map(normalizeDevice) } as AxiosResponse<Device[]>;
  },
  getById: async (deviceId: string) => {
    const res = await api.get<any>(`/devices/${encodeURIComponent(deviceId)}`);
    return { ...res, data: normalizeDevice(res.data) } as AxiosResponse<Device>;
  },
  getHistory: (deviceId: string) => api.get<DeviceHistory>(`/devices/${encodeURIComponent(deviceId)}/history`),
  getCrawlerLogs: (deviceId: string) =>
    internalApi.get<DeviceCrawlerLogs>(`/crawler-logs/${encodeURIComponent(deviceId)}`),
  getCrawlerLogsAll: (params?: { days?: number | null; limit?: number }) =>
    internalApi.get<DeviceCrawlerLogs[]>('/crawler-logs', {
      params: {
        ...(params?.days !== undefined ? { days: params.days } : {}),
        ...(params?.limit !== undefined ? { limit: params.limit } : {}),
      },
    }),
  create: async (data: CreateDeviceRequest) => {
    const res = await api.post<any>('/devices', data);
    return { ...res, data: normalizeDevice(res.data) } as AxiosResponse<Device>;
  },
  update: async (deviceId: string, data: UpdateDeviceRequest) => {
    const res = await api.put<any>(`/devices/${encodeURIComponent(deviceId)}`, data);
    return { ...res, data: normalizeDevice(res.data) } as AxiosResponse<Device>;
  },
  delete: (deviceId: string) => api.delete<Device>(`/devices/${encodeURIComponent(deviceId)}`),
};

// API methods for accounts
export const accountApi = {
  getAll: () => api.get<Account[]>('/accounts'),
  getById: async (accountId: string, includeDevices = false) => {
    const res = await api.get<any>(`/accounts/${encodeURIComponent(accountId)}`, {
      params: includeDevices ? { include_devices: true } : undefined,
    });
    return { ...res, data: normalizeAccount(res.data) } as AxiosResponse<Account>;
  },
  create: (data: CreateAccountRequest) => api.post<Account>('/accounts', data),
  update: (accountId: string, data: UpdateAccountRequest) => 
    api.put<Account>(`/accounts/${encodeURIComponent(accountId)}`, data),
  delete: (accountId: string) => api.delete<Account>(`/accounts/${encodeURIComponent(accountId)}`),
};
