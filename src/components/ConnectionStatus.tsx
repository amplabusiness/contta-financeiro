import { useOfflineMode } from "@/hooks/useOfflineMode";
import { AlertCircle, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export function ConnectionStatus() {
  const { isOnline, isOfflineMode } = useOfflineMode();
  const [isAttemptingConnection, setIsAttemptingConnection] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setIsAttemptingConnection(true);
      const timer = setTimeout(() => setIsAttemptingConnection(false), 3000);
      return () => clearTimeout(timer);
    }
    setIsAttemptingConnection(false);
  }, [isOnline]);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className={`
        flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg
        ${isOfflineMode 
          ? 'bg-orange-100 border border-orange-300 text-orange-800' 
          : 'bg-red-100 border border-red-300 text-red-800'
        }
      `}>
        {isAttemptingConnection ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Conectando...</span>
          </>
        ) : isOfflineMode ? (
          <>
            <WifiOff className="w-5 h-5" />
            <span className="text-sm font-medium">
              Modo offline - Dados do cache
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">
              Sem conexão com servidor
            </span>
          </>
        )}
      </div>
    </div>
  );
}
