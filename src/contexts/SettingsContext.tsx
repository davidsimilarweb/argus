import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface SettingsContextType {
  availableModels: string[];
  baseIp: string;
  allowedCountries: string[];
  healthGraceMinutes: number;
  isLoading: boolean;
  setAvailableModels: (models: string[]) => void;
  setBaseIp: (ip: string) => void;
  setAllowedCountries: (countries: string[]) => void;
  setHealthGraceMinutes: (minutes: number) => void;
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

  return (
    <SettingsContext.Provider
      value={{
        availableModels,
        baseIp,
        allowedCountries,
        healthGraceMinutes,
        isLoading,
        setAvailableModels,
        setBaseIp,
        setAllowedCountries,
        setHealthGraceMinutes,
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
