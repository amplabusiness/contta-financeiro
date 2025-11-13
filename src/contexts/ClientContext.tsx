import { createContext, useContext, useState, ReactNode } from "react";

interface ClientContextType {
  selectedClientId: string | null;
  selectedClientName: string | null;
  setSelectedClient: (id: string | null, name: string | null) => void;
  clearSelectedClient: () => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider = ({ children }: { children: ReactNode }) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);

  const setSelectedClient = (id: string | null, name: string | null) => {
    setSelectedClientId(id);
    setSelectedClientName(name);
  };

  const clearSelectedClient = () => {
    setSelectedClientId(null);
    setSelectedClientName(null);
  };

  return (
    <ClientContext.Provider
      value={{
        selectedClientId,
        selectedClientName,
        setSelectedClient,
        clearSelectedClient,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error("useClient must be used within ClientProvider");
  }
  return context;
};
