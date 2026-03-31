import axios from 'axios';
import type { AxiosResponse } from 'axios';

// Requests go through Next.js API routes (server-side proxy injects auth token)
export const api = axios.create({
  baseURL: '/api/argus',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate client for internal crawler endpoints
export const internalApi = axios.create({
  baseURL: '/api/internal',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Called by AxiosEnvSync whenever the user switches environment.
// Sets x-argus-env on every outgoing request so the proxy route picks the right target.
export function setApiEnvHeader(env: 'production' | 'staging') {
  const value = env === 'staging' ? 'staging' : 'production';
  api.defaults.headers.common['x-argus-env'] = value;
  internalApi.defaults.headers.common['x-argus-env'] = value;
}

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

// Extracts the physical slot number from extra_data.slot (set by set_device_slots.py).
// Returns null when the slot has not yet been assigned.
export function getDeviceSlot(device: { extra_data?: DeviceMetadata | null }): number | null {
  const slot = device.extra_data?.slot;
  return typeof slot === 'number' ? slot : null;
}

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

// Aggregated stats from /internal/stats
export interface StatsDayEntry {
  date: string; // 'YYYY-MM-DD'
  num_started: number;
  num_success: number;
  num_failure: number;
  num_doesnt_exist: number;
  failure_rate: string; // e.g. '24%'
}

export interface StatsCountryDayEntry {
  date: string;
  count: number; // success count for that country+day
}

export interface StatsResponse {
  today: StatsDayEntry & {
    last_crawl_ts: string;
    num_total_per_country: Record<string, Omit<StatsDayEntry, 'date'>>;
    days: Array<{ date: string; num_started: number; num_success: number; num_failure: number }>;
  };
  num_started_all_time: number;
  num_total_all_time: number;
  num_failure_all_time: number;
  num_doesnt_exist_all_time: number;
  failure_rate_all_time: string;
  agg_daily: StatsDayEntry[];
  agg_daily_country: Record<string, StatsCountryDayEntry[]>;
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
  getStats: (params?: { days?: number }) =>
    internalApi.get<StatsResponse>('/stats', {
      params: { ...(params?.days !== undefined ? { days: params.days } : {}) },
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
