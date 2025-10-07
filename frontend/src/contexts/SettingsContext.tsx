import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { settingsApi } from '../lib/api';

interface SettingsContextType {
  availableModels: string[];
  baseIp: string;
  isLoading: boolean;
  setAvailableModels: (models: string[]) => Promise<void>;
  setBaseIp: (ip: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultModels = [
  'iPhone SE (1st gen)',
  'iPhone SE (2nd gen)',
  'iPhone SE (3rd gen)',
  'iPhone 6s',
  'iPhone 7',
  'iPhone 8',
  'iPhone X',
  'iPhone XR',
  'iPhone XS',
  'iPhone 11',
  'iPhone 12',
  'iPhone 13',
  'iPhone 14',
  'iPhone 15',
  'iPad (5th gen)',
  'iPad (6th gen)',
  'iPad (7th gen)',
  'iPad (8th gen)',
  'iPad (9th gen)',
  'iPad Air',
  'iPad Pro',
];

const defaultBaseIp = '192.168.0';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [availableModels, setAvailableModelsState] = useState<string[]>(defaultModels);
  const [baseIp, setBaseIpState] = useState<string>(defaultBaseIp);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch settings from backend on mount
  const refreshSettings = async () => {
    try {
      setIsLoading(true);
      const response = await settingsApi.getAll();
      if (response.data.success && response.data.data) {
        const settings = response.data.data;

        if (settings.availableModels) {
          setAvailableModelsState(JSON.parse(settings.availableModels));
        }

        if (settings.baseIp) {
          setBaseIpState(settings.baseIp);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      // Use defaults if fetch fails
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const setAvailableModels = async (models: string[]) => {
    setAvailableModelsState(models);
    try {
      await settingsApi.upsert('availableModels', JSON.stringify(models));
    } catch (error) {
      console.error('Failed to save available models:', error);
      throw error;
    }
  };

  const setBaseIp = async (ip: string) => {
    setBaseIpState(ip);
    try {
      await settingsApi.upsert('baseIp', ip);
    } catch (error) {
      console.error('Failed to save base IP:', error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        availableModels,
        baseIp,
        isLoading,
        setAvailableModels,
        setBaseIp,
        refreshSettings,
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
