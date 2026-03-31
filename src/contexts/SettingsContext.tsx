'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type ApiEnv = 'production' | 'staging';

interface SettingsContextType {
  availableModels: string[];
  baseIp: string;
  allowedCountries: string[];
  healthGraceMinutes: number;
  healthWindowHours: number;
  healthDecayHours: number;
  apiEnv: ApiEnv;
  isLoading: boolean;
  setAvailableModels: (models: string[]) => void;
  setBaseIp: (ip: string) => void;
  setAllowedCountries: (countries: string[]) => void;
  setHealthGraceMinutes: (minutes: number) => void;
  setHealthWindowHours: (hours: number) => void;
  setHealthDecayHours: (hours: number) => void;
  setApiEnv: (env: ApiEnv) => void;
}

const defaultModels = [
  'iPhone 6s',
  'iPhone 7',
  'iPhone 8',
  'iPad (7th gen)',
  'iPad (8th gen)',
];

const STORAGE_KEYS = {
  AVAILABLE_MODELS: 'argus_available_models',
  BASE_IP: 'argus_base_ip',
  ALLOWED_COUNTRIES: 'argus_allowed_countries',
  HEALTH_GRACE_MINUTES: 'argus_health_grace_minutes',
  HEALTH_WINDOW_HOURS: 'argus_health_window_hours',
  HEALTH_DECAY_HOURS: 'argus_health_decay_hours',
  API_ENV: 'argus_api_env',
};

const defaultBaseIp = '192.168.0';
const defaultAllowedCountries = [
  "AU",
  "BR",
  "CA",
  "CN",
  "DE",
  "ES",
  "FR",
  "GB",
  "IN",
  "IT",
  "JP",
  "KR",
  "RU",
  "TW",
  "US",
];

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [availableModels, setAvailableModelsState] = useState<string[]>(defaultModels);
  const [baseIp, setBaseIpState] = useState<string>(defaultBaseIp);
  const [allowedCountries, setAllowedCountriesState] = useState<string[]>(defaultAllowedCountries);
  const [healthGraceMinutes, setHealthGraceMinutesState] = useState<number>(20);
  const [healthWindowHours, setHealthWindowHoursState] = useState<number>(12);
  const [healthDecayHours, setHealthDecayHoursState] = useState<number>(12);
  const [apiEnv, setApiEnvState] = useState<ApiEnv>('production');
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const storedModels = localStorage.getItem(STORAGE_KEYS.AVAILABLE_MODELS);
      if (storedModels) {
        setAvailableModelsState(JSON.parse(storedModels));
      }

      const storedBaseIp = localStorage.getItem(STORAGE_KEYS.BASE_IP);
      if (storedBaseIp) {
        setBaseIpState(storedBaseIp);
      }

      const storedCountries = localStorage.getItem(STORAGE_KEYS.ALLOWED_COUNTRIES);
      if (storedCountries) {
        setAllowedCountriesState(JSON.parse(storedCountries));
      }

      const storedGrace = localStorage.getItem(STORAGE_KEYS.HEALTH_GRACE_MINUTES);
      if (storedGrace) {
        const parsed = parseInt(storedGrace, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          setHealthGraceMinutesState(parsed);
        }
      }

      const storedWindow = localStorage.getItem(STORAGE_KEYS.HEALTH_WINDOW_HOURS);
      if (storedWindow) {
        const parsed = parseInt(storedWindow, 10);
        if (!Number.isNaN(parsed) && parsed >= 1) {
          setHealthWindowHoursState(parsed);
        }
      }

      const storedDecay = localStorage.getItem(STORAGE_KEYS.HEALTH_DECAY_HOURS);
      if (storedDecay) {
        const parsed = parseInt(storedDecay, 10);
        if (!Number.isNaN(parsed) && parsed >= 1) {
          setHealthDecayHoursState(parsed);
        }
      }

      const storedApiEnv = localStorage.getItem(STORAGE_KEYS.API_ENV);
      if (storedApiEnv === 'staging' || storedApiEnv === 'production') {
        setApiEnvState(storedApiEnv);
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setAvailableModels = (models: string[]) => {
    setAvailableModelsState(models);
    localStorage.setItem(STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(models));
  };

  const setBaseIp = (ip: string) => {
    setBaseIpState(ip);
    localStorage.setItem(STORAGE_KEYS.BASE_IP, ip);
  };

  const setAllowedCountries = (countries: string[]) => {
    setAllowedCountriesState(countries);
    localStorage.setItem(STORAGE_KEYS.ALLOWED_COUNTRIES, JSON.stringify(countries));
  };

  const setHealthGraceMinutes = (minutes: number) => {
    const safe = Math.max(0, Math.round(minutes));
    setHealthGraceMinutesState(safe);
    localStorage.setItem(STORAGE_KEYS.HEALTH_GRACE_MINUTES, String(safe));
  };

  const setHealthWindowHours = (hours: number) => {
    const safe = Math.max(1, Math.min(168, Math.round(hours)));
    setHealthWindowHoursState(safe);
    localStorage.setItem(STORAGE_KEYS.HEALTH_WINDOW_HOURS, String(safe));
  };

  const setHealthDecayHours = (hours: number) => {
    const safe = Math.max(1, Math.min(48, Math.round(hours)));
    setHealthDecayHoursState(safe);
    localStorage.setItem(STORAGE_KEYS.HEALTH_DECAY_HOURS, String(safe));
  };

  const setApiEnv = (env: ApiEnv) => {
    setApiEnvState(env);
    localStorage.setItem(STORAGE_KEYS.API_ENV, env);
  };

  return (
    <SettingsContext.Provider
      value={{
        availableModels,
        baseIp,
        allowedCountries,
        healthGraceMinutes,
        healthWindowHours,
        healthDecayHours,
        apiEnv,
        isLoading,
        setAvailableModels,
        setBaseIp,
        setAllowedCountries,
        setHealthGraceMinutes,
        setHealthWindowHours,
        setHealthDecayHours,
        setApiEnv,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
