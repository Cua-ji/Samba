import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

const STORAGE_USER_KEY = 'samba_active_user_id';
const STORAGE_ONBOARDING_KEY = 'samba_onboarding_draft';

const DEFAULT_ONBOARDING = {
  name: '',
  goal: 'perder_grasa',
  sex: 'hombre',
  age: 28,
  weightKg: 72.5,
  heightCm: 176,
  activityLevel: 'ligeramente',
  allergies: ['lactosa'],
  injuries: [],
  role: 'usuario',
};

const SambaContext = createContext(null);

export function SambaProvider({ children }) {
  const [screen, setScreen] = useState('welcome');
  const [user, setUser] = useState(null);
  const [metabolism, setMetabolism] = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState('inicio');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  const [onboarding, setOnboarding] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ONBOARDING_KEY);
      return saved ? { ...DEFAULT_ONBOARDING, ...JSON.parse(saved) } : DEFAULT_ONBOARDING;
    } catch {
      return DEFAULT_ONBOARDING;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ONBOARDING_KEY, JSON.stringify(onboarding));
    } catch {
      // ignore storage errors
    }
  }, [onboarding]);

  const updateOnboarding = useCallback((patch) => {
    setOnboarding((prev) => ({ ...prev, ...patch }));
  }, []);

  const refreshProfile = useCallback(async (targetUserId) => {
    const id = targetUserId || user?.id;
    if (!id) return null;
    const data = await api.getProfile(id);
    setUser(data.user);
    setMetabolism(data.metabolism);
    setTodayLog(data.todayLog);
    return data;
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    async function restore() {
      try {
        const storedId = localStorage.getItem(STORAGE_USER_KEY);
        if (storedId) {
          const data = await api.getProfile(storedId);
          if (mounted && data?.user) {
            setUser(data.user);
            setMetabolism(data.metabolism);
            setTodayLog(data.todayLog);
            setScreen('app');
            setActiveTab('inicio');
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_USER_KEY);
      } finally {
        if (mounted) setLoadingSession(false);
      }
    }
    restore();
    return () => {
      mounted = false;
    };
  }, []);

  const enterDashboardWithSession = useCallback(async (authData) => {
    localStorage.setItem(STORAGE_USER_KEY, authData.user.id);
    setUser(authData.user);
    setMetabolism(authData.metabolism);
    try {
      const profileData = await api.getProfile(authData.user.id);
      setTodayLog(profileData.todayLog);
    } catch {
      setTodayLog(null);
    }
    setActiveTab('inicio');
    setScreen('app');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    setMetabolism(null);
    setTodayLog(null);
    setProfileOpen(false);
    setChatOpen(false);
    setScreen('welcome');
  }, []);

  const openChatWithPrompt = useCallback((prompt = '') => {
    setChatInitialPrompt(prompt);
    setChatOpen(true);
  }, []);

  const value = {
    screen,
    setScreen,
    activeTab,
    setActiveTab,
    user,
    setUser,
    metabolism,
    setMetabolism,
    todayLog,
    setTodayLog,
    loadingSession,
    onboarding,
    updateOnboarding,
    refreshProfile,
    enterDashboardWithSession,
    logout,
    chatOpen,
    setChatOpen,
    chatInitialPrompt,
    setChatInitialPrompt,
    openChatWithPrompt,
    profileOpen,
    setProfileOpen,
  };

  return <SambaContext.Provider value={value}>{children}</SambaContext.Provider>;
}

export function useSamba() {
  const ctx = useContext(SambaContext);
  if (!ctx) throw new Error('useSamba debe usarse dentro de SambaProvider');
  return ctx;
}
