import { useState, useCallback } from 'react';
import api from '../lib/axios';
import { debounce } from '../lib/utils';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchNumber = useCallback(
    debounce(async (phone) => {
      if (!phone || phone.replace(/\D/g, '').length < 10) {
        setResult(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get('/search/number', {
          params: { q: phone },
        });
        setResult(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Search failed');
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  const handleQueryChange = (value) => {
    // Strip non-digits except + for display
    const cleaned = value.replace(/[^\d+\-() ]/g, '');
    setQuery(cleaned);
    searchNumber(cleaned);
  };

  const clearSearch = () => {
    setQuery('');
    setResult(null);
    setError(null);
  };

  return {
    query,
    result,
    isLoading,
    error,
    handleQueryChange,
    clearSearch,
  };
}
