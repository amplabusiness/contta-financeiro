import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExpenseUpdateContextType {
  lastUpdate: number;
  notifyExpenseChange: () => void;
  subscribeToExpenseChanges: (callback: () => void) => () => void;
}

const ExpenseUpdateContext = createContext<ExpenseUpdateContextType | undefined>(undefined);

export const ExpenseUpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [listeners, setListeners] = useState<Set<() => void>>(new Set());

  const notifyExpenseChange = useCallback(() => {
    setLastUpdate(Date.now());
    listeners.forEach(listener => listener());
  }, [listeners]);

  const subscribeToExpenseChanges = useCallback((callback: () => void) => {
    setListeners(prev => new Set([...prev, callback]));
    return () => {
      setListeners(prev => {
        const next = new Set(prev);
        next.delete(callback);
        return next;
      });
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
