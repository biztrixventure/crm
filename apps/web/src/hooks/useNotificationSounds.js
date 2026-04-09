import { useCallback, useEffect, useRef } from 'react';
import { getSoundPath, NOTIFICATION_SOUNDS } from '../lib/sounds';

/**
 * Hook to manage notification sounds
 * Handles loading, playing, volume control, and user preferences
 */
export function useNotificationSounds() {
  const audioRef = useRef(null);
  const soundsRef = useRef({});
  const preferencesRef = useRef({
    enabled: true,
    volume: 0.7, // Default 70% volume
    soundTypes: {
      transfer: true,
      callback: true,
      sale: true,
      batch: true,
      alert: true,
    },
  });

  // Load user preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('notification_sound_preferences');
    if (saved) {
      try {
        const preferences = JSON.parse(saved);
        preferencesRef.current = { ...preferencesRef.current, ...preferences };
      } catch (err) {
        console.error('Failed to load sound preferences:', err);
      }
    }

    // Pre-load all notification sounds
    loadSounds();
  }, []);

  /**
   * Load all notification sounds
   */
  const loadSounds = useCallback(async () => {
    try {
      for (const [key, filename] of Object.entries(NOTIFICATION_SOUNDS)) {
        const audio = new Audio(getSoundPath(key));
        audio.preload = 'auto';
        soundsRef.current[key] = audio;
      }
    } catch (err) {
      console.error('Failed to load sounds:', err);
    }
  }, []);

  /**
   * Play notification sound
   * @param {string} soundType - Type of sound (transfer, callback, sale, batch, alert)
   */
  const playSound = useCallback((soundType) => {
    // Check if sounds are disabled
    if (!preferencesRef.current.enabled) {
      return;
    }

    // Check if this sound type is enabled
    if (!preferencesRef.current.soundTypes[soundType]) {
      return;
    }

    try {
      const audio = soundsRef.current[soundType];
      if (audio) {
        audio.volume = preferencesRef.current.volume;
        audio.currentTime = 0; // Reset to start
        audio.play().catch((err) => {
          console.warn('Failed to play sound:', err);
          // Fail silently - some browsers block autoplay
        });
      }
    } catch (err) {
      console.error('Failed to play sound:', err);
    }
  }, []);

  /**
   * Set overall sound enabled/disabled
   * @param {boolean} enabled
   */
  const setSoundsEnabled = useCallback((enabled) => {
    preferencesRef.current.enabled = enabled;
    localStorage.setItem(
      'notification_sound_preferences',
      JSON.stringify(preferencesRef.current)
    );
  }, []);

  /**
   * Set volume level (0-1)
   * @param {number} volume - Volume level from 0 to 1
   */
  const setVolume = useCallback((volume) => {
    const normalized = Math.max(0, Math.min(1, volume));
    preferencesRef.current.volume = normalized;
    localStorage.setItem(
      'notification_sound_preferences',
      JSON.stringify(preferencesRef.current)
    );
  }, []);

  /**
   * Enable/disable specific sound type
   * @param {string} soundType - Sound type key
   * @param {boolean} enabled
   */
  const setSoundTypeEnabled = useCallback((soundType, enabled) => {
    preferencesRef.current.soundTypes[soundType] = enabled;
    localStorage.setItem(
      'notification_sound_preferences',
      JSON.stringify(preferencesRef.current)
    );
  }, []);

  /**
   * Get current preferences
   */
  const getPreferences = useCallback(() => {
    return { ...preferencesRef.current };
  }, []);

  return {
    playSound,
    setSoundsEnabled,
    setVolume,
    setSoundTypeEnabled,
    getPreferences,
  };
}
