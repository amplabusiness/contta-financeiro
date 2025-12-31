import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Office {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  is_active: boolean;
  role?: string; // Papel do usuário neste escritório
}

interface OfficeContextType {
  offices: Office[];
  selectedOfficeId: string | null;
  selectedOfficeName: string | null;
  selectedOfficeRole: string | null; // Papel do usuário no escritório selecionado
  setSelectedOffice: (id: string, name: string) => void;
  clearSelectedOffice: () => void;
  loading: boolean;
  refreshOffices: () => Promise<void>;
  hasAccess: (officeId: string) => boolean;
}

const OfficeContext = createContext<OfficeContextType | undefined>(undefined);

export const useOffice = () => {
  const context = useContext(OfficeContext);
  if (!context) {
    throw new Error('useOffice must be used within an OfficeProvider');
  }
  return context;
};

interface OfficeProviderProps {
  children: ReactNode;
}

export const OfficeProvider: React.FC<OfficeProviderProps> = ({ children }) => {
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [selectedOfficeName, setSelectedOfficeName] = useState<string | null>(null);
  const [selectedOfficeRole, setSelectedOfficeRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('selectedOffice');
      if (saved) {
        const { id, name, role } = JSON.parse(saved);
        setSelectedOfficeId(id);
        setSelectedOfficeName(name);
        setSelectedOfficeRole(role || null);
      }
    } catch (e) {
      console.error('Error loading selected office from localStorage:', e);
    }
  }, []);

  // Salvar no localStorage quando mudar
  useEffect(() => {
    if (selectedOfficeId && selectedOfficeName) {
      localStorage.setItem('selectedOffice', JSON.stringify({
        id: selectedOfficeId,
        name: selectedOfficeName,
        role: selectedOfficeRole
      }));
    } else {
      localStorage.removeItem('selectedOffice');
    }
  }, [selectedOfficeId, selectedOfficeName, selectedOfficeRole]);

  const refreshOffices = useCallback(async () => {
    try {
      setLoading(true);

      // Primeiro, tenta buscar escritórios com permissões do usuário
      const { data: userOffices, error: userError } = await supabase
        .rpc('get_user_offices');

      if (!userError && userOffices && userOffices.length > 0) {
        // Usuário tem permissões específicas - buscar detalhes dos escritórios
        const officeIds = userOffices.map((uo: any) => uo.office_id);

        const { data: officeDetails, error: detailsError } = await supabase
          .from('accounting_office')
          .select('id, razao_social, nome_fantasia, cnpj, is_active')
          .in('id', officeIds)
          .eq('is_active', true);

        if (!detailsError && officeDetails) {
          // Mesclar detalhes com permissões
          const officesWithRoles = officeDetails.map(office => {
            const userOffice = userOffices.find((uo: any) => uo.office_id === office.id);
            return {
              ...office,
              role: userOffice?.role || 'user'
            };
          });

          setOffices(officesWithRoles);

          // Se não tem escritório selecionado, usar o default ou o primeiro
          if (!selectedOfficeId) {
            const defaultOffice = userOffices.find((uo: any) => uo.is_default);
            const officeToSelect = defaultOffice
              ? officesWithRoles.find(o => o.id === defaultOffice.office_id)
              : officesWithRoles[0];

            if (officeToSelect) {
              const name = officeToSelect.nome_fantasia || officeToSelect.razao_social;
              setSelectedOfficeId(officeToSelect.id);
              setSelectedOfficeName(name);
              setSelectedOfficeRole(officeToSelect.role || null);
            }
          }

          setLoading(false);
          return;
        }
      }

      // Fallback: buscar todos os escritórios (para admin ou quando não há permissões configuradas)
      const { data, error } = await supabase
        .from('accounting_office')
        .select('id, razao_social, nome_fantasia, cnpj, is_active')
        .eq('is_active', true)
        .order('nome_fantasia');

      if (error) {
        console.error('Error loading offices:', error);
        return;
      }

      setOffices(data || []);

      // Se não tem escritório selecionado e existe pelo menos um, selecionar o primeiro
      if (!selectedOfficeId && data && data.length > 0) {
        const firstOffice = data[0];
        const name = firstOffice.nome_fantasia || firstOffice.razao_social;
        setSelectedOfficeId(firstOffice.id);
        setSelectedOfficeName(name);
        setSelectedOfficeRole('admin'); // Assume admin se não tem permissões configuradas
      }
    } catch (error) {
      console.error('Error in refreshOffices:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedOfficeId]);

  useEffect(() => {
    refreshOffices();
  }, [refreshOffices]);

  const setSelectedOffice = (id: string, name: string) => {
    const office = offices.find(o => o.id === id);
    setSelectedOfficeId(id);
    setSelectedOfficeName(name);
    setSelectedOfficeRole(office?.role || null);
  };

  const clearSelectedOffice = () => {
    setSelectedOfficeId(null);
    setSelectedOfficeName(null);
    setSelectedOfficeRole(null);
  };

  const hasAccess = (officeId: string) => {
    return offices.some(o => o.id === officeId);
  };

  return (
    <OfficeContext.Provider
      value={{
        offices,
        selectedOfficeId,
        selectedOfficeName,
        selectedOfficeRole,
        setSelectedOffice,
        clearSelectedOffice,
        loading,
        refreshOffices,
        hasAccess,
      }}
    >
      {children}
    </OfficeContext.Provider>
  );
};
