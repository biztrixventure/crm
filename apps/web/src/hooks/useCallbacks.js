import { useState, useEffect, useCallback } from 'react';
import api from '../lib/axios';

export function useCallbacks() {
  const [callbacks, setCallbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCallbacks = useCallback(async (includeFired = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/callbacks', {
        params: { include_fired: includeFired },
      });
      setCallbacks(response.data.callbacks);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch callbacks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCallback = async (data) => {
    try {
      const response = await api.post('/callbacks', data);
      setCallbacks((prev) => [response.data.callback, ...prev]);
      return { success: true, callback: response.data.callback };
    } catch (err) {
      return { error: err.response?.data?.error || 'Failed to create callback' };
    }
  };

  const updateCallback = async (id, data) => {
    try {
      const response = await api.patch(`/callbacks/${id}`, data);
      setCallbacks((prev) =>
        prev.map((cb) => (cb.id === id ? response.data.callback : cb))
      );
      return { success: true, callback: response.data.callback };
    } catch (err) {
      return { error: err.response?.data?.error || 'Failed to update callback' };
    }
  };

  const deleteCallback = async (id) => {
    try {
      await api.delete(`/callbacks/${id}`);
      setCallbacks((prev) => prev.filter((cb) => cb.id !== id));
      return { success: true };
    } catch (err) {
      return { error: err.response?.data?.error || 'Failed to delete callback' };
    }
  };

  useEffect(() => {
    fetchCallbacks();
  }, [fetchCallbacks]);

  return {
    callbacks,
    isLoading,
    error,
    fetchCallbacks,
    createCallback,
    updateCallback,
    deleteCallback,
  };
}
