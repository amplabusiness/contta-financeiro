import { useState, useEffect } from "react";

interface OfflineData {
  dashboardStats: any;
  clients: any[];
  invoices: any[];
  timestamp: number;
}

const OFFLINE_STORAGE_KEY = "app_offline_data";
const OFFLINE_MODE_KEY = "app_offline_mode";

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(() => {
    // Check if navigator.onLine is available and true
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [offlineData, setOfflineData] = useState<OfflineData | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.warn("Erro ao carregar dados offline:", error);
        return null;
      }
    }
    return null;
  });

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log("🟢 Aplicação online");
      setIsOnline(true);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(OFFLINE_MODE_KEY);
      }
    };

    const handleOffline = () => {
      console.log("🔴 Aplicação offline");
      setIsOnline(false);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(OFFLINE_MODE_KEY, "true");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const saveOfflineData = (data: Partial<OfflineData>) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const merged = {
          ...offlineData,
          ...data,
          timestamp: Date.now(),
        };
        localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(merged));
        setOfflineData(merged);
      } catch (error) {
        console.warn("Erro ao salvar dados offline:", error);
      }
    }
  };

  const clearOfflineData = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(OFFLINE_STORAGE_KEY);
        localStorage.removeItem(OFFLINE_MODE_KEY);
        setOfflineData(null);
      } catch (error) {
        console.warn("Erro ao limpar dados offline:", error);
      }
    }
  };

  return {
    isOnline,
    offlineData,
    saveOfflineData,
    clearOfflineData,
    isOfflineMode: !isOnline || (typeof window !== 'undefined' && !!localStorage.getItem(OFFLINE_MODE_KEY)),
  };
}
