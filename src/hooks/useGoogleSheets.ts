import { useState, useEffect, useCallback } from 'react';
import { sheetsService } from '../services/googleSheets';
import { Transaction } from '../types';

interface UseGoogleSheetsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useGoogleSheets({ autoRefresh = true, refreshInterval = 30000 }: UseGoogleSheetsOptions = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (force = false) => {
    try {
      setError(null);
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
      if (apiKey) sheetsService.setApiKey(apiKey);
      const data = await sheetsService.fetchData(force);
      setTransactions(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Error al cargar datos. Usando caché si está disponible.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchData(), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  const refresh = useCallback((force = true) => {
    setLoading(true);
    fetchData(force);
  }, [fetchData]);

  return { transactions, loading, error, lastUpdated, refresh };
}
