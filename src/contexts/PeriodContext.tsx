import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { format } from 'date-fns';

interface PeriodContextType {
  selectedYear: number;
  selectedMonth: number;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: number) => void;
  getFormattedPeriod: () => string;
  getStartDate: () => Date;
  getEndDate: () => Date;
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

export const PeriodProvider: React.FC<PeriodProviderProps> = ({ children }) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);

  // Save to localStorage whenever period changes
  useEffect(() => {
    localStorage.setItem('workingPeriod', JSON.stringify({ year: selectedYear, month: selectedMonth }));
  }, [selectedYear, selectedMonth]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('workingPeriod');
    if (saved) {
      try {
        const { year, month } = JSON.parse(saved);
        setSelectedYear(year);
        setSelectedMonth(month);
      } catch (e) {
        console.error('Error loading working period:', e);
      }
    }
  }, []);

  const getFormattedPeriod = () => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[selectedMonth - 1]} de ${selectedYear}`;
  };

  const getStartDate = () => {
    return new Date(selectedYear, selectedMonth - 1, 1);
  };

  const getEndDate = () => {
    return new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
  };

  return (
    <PeriodContext.Provider
      value={{
        selectedYear,
        selectedMonth,
        setSelectedYear,
        setSelectedMonth,
        getFormattedPeriod,
        getStartDate,
        getEndDate,
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
};
