import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExpenseUpdateContextType {
  lastUpdate: number;
  notifyExpenseChange: () => void;
  subscribeToExpenseChanges: (callback: () => void) => () => void;
}

const ExpenseUpdateContext = createContext<ExpenseUpdateContextType | undefined>(undefined);

export const ExpenseUpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  // Use ref instead of state for listeners to avoid stale closure issues
  const listenersRef = useRef<Set<() => void>>(new Set());

  const notifyExpenseChange = useCallback(() => {
    setLastUpdate(Date.now());
    listenersRef.current.forEach(listener => listener());
  }, []); // No dependencies - stable callback

  const subscribeToExpenseChanges = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  // Setup Supabase realtime subscription for expenses
  useEffect(() => {
    const subscription = supabase
      .channel('expenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses'
        },
        () => {
          notifyExpenseChange();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [notifyExpenseChange]);

  return (
    <ExpenseUpdateContext.Provider value={{ lastUpdate, notifyExpenseChange, subscribeToExpenseChanges }}>
      {children}
    </ExpenseUpdateContext.Provider>
  );
};

export const useExpenseUpdate = () => {
  const context = useContext(ExpenseUpdateContext);
  if (!context) {
    throw new Error('useExpenseUpdate must be used within ExpenseUpdateProvider');
  }
  return context;
};
