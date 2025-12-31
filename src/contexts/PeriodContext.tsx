import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PeriodContextType {
  // Período de trabalho (mês único para operações do dia-a-dia)
  selectedYear: number;
  selectedMonth: number;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: number) => void;
  getFormattedPeriod: () => string;
  getStartDate: () => Date;
  getEndDate: () => Date;

  // Período de intervalo (para relatórios contábeis como DRE, Balancete)
  rangeStartYear: number;
  rangeStartMonth: number;
  rangeEndYear: number;
  rangeEndMonth: number;
  setRangeStart: (year: number, month: number) => void;
  setRangeEnd: (year: number, month: number) => void;
  getRangeStartDate: () => Date;
  getRangeEndDate: () => Date;
  getFormattedRange: () => string;

  // Funções auxiliares
  getCompetence: () => string; // Formato "MM/YYYY"
  getRangeCompetences: () => { start: string; end: string }; // Formato "MM/YYYY"
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export const usePeriod = () => {
  const context = useContext(PeriodContext);
  if (!context) {
    throw new Error('usePeriod must be used within a PeriodProvider');
  }
  return context;
};

interface PeriodProviderProps {
  children: ReactNode;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const PeriodProvider: React.FC<PeriodProviderProps> = ({ children }) => {
  const currentDate = new Date();

  // Initialize state from localStorage if available
  const getInitialPeriod = () => {
    try {
      const saved = localStorage.getItem('workingPeriod');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading working period from localStorage:', e);
    }
    return {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      rangeStartYear: currentDate.getFullYear(),
      rangeStartMonth: 1, // Janeiro
      rangeEndYear: currentDate.getFullYear(),
      rangeEndMonth: currentDate.getMonth() + 1,
    };
  };

  const initial = getInitialPeriod();

  // Período de trabalho (mês único)
  const [selectedYear, setSelectedYear] = useState<number>(initial.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initial.month);

  // Período de intervalo (para relatórios)
  const [rangeStartYear, setRangeStartYear] = useState<number>(initial.rangeStartYear);
  const [rangeStartMonth, setRangeStartMonth] = useState<number>(initial.rangeStartMonth);
  const [rangeEndYear, setRangeEndYear] = useState<number>(initial.rangeEndYear);
  const [rangeEndMonth, setRangeEndMonth] = useState<number>(initial.rangeEndMonth);

  // Save to localStorage whenever period changes
  useEffect(() => {
    localStorage.setItem('workingPeriod', JSON.stringify({
      year: selectedYear,
      month: selectedMonth,
      rangeStartYear,
      rangeStartMonth,
      rangeEndYear,
      rangeEndMonth,
    }));
  }, [selectedYear, selectedMonth, rangeStartYear, rangeStartMonth, rangeEndYear, rangeEndMonth]);

  // Funções para período de trabalho (mês único)
  const getFormattedPeriod = () => {
    return `${MONTH_NAMES[selectedMonth - 1]} de ${selectedYear}`;
  };

  const getStartDate = () => {
    return new Date(selectedYear, selectedMonth - 1, 1);
  };

  const getEndDate = () => {
    return new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
  };

  const getCompetence = () => {
    return `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
  };

  // Funções para período de intervalo (relatórios)
  const setRangeStart = (year: number, month: number) => {
    setRangeStartYear(year);
    setRangeStartMonth(month);
  };

  const setRangeEnd = (year: number, month: number) => {
    setRangeEndYear(year);
    setRangeEndMonth(month);
  };

  const getRangeStartDate = () => {
    return new Date(rangeStartYear, rangeStartMonth - 1, 1);
  };

  const getRangeEndDate = () => {
    return new Date(rangeEndYear, rangeEndMonth, 0, 23, 59, 59);
  };

  const getFormattedRange = () => {
    if (rangeStartYear === rangeEndYear && rangeStartMonth === rangeEndMonth) {
      return `${MONTH_NAMES[rangeStartMonth - 1]} de ${rangeStartYear}`;
    }
    return `${MONTH_NAMES[rangeStartMonth - 1]}/${rangeStartYear} a ${MONTH_NAMES[rangeEndMonth - 1]}/${rangeEndYear}`;
  };

  const getRangeCompetences = () => {
    return {
      start: `${String(rangeStartMonth).padStart(2, '0')}/${rangeStartYear}`,
      end: `${String(rangeEndMonth).padStart(2, '0')}/${rangeEndYear}`,
    };
  };

  return (
    <PeriodContext.Provider
      value={{
        // Período de trabalho
        selectedYear,
        selectedMonth,
        setSelectedYear,
        setSelectedMonth,
        getFormattedPeriod,
        getStartDate,
        getEndDate,

        // Período de intervalo
        rangeStartYear,
        rangeStartMonth,
        rangeEndYear,
        rangeEndMonth,
        setRangeStart,
        setRangeEnd,
        getRangeStartDate,
        getRangeEndDate,
        getFormattedRange,

        // Auxiliares
        getCompetence,
        getRangeCompetences,
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
};
