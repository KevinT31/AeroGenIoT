import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ENV } from "../config/env";
import { backendApi, setApiAccessToken } from "../services/api";
import { analyticsService } from "../services/analyticsService";
import { sessionStorage } from "../services/sessionStorage";
import { AuthSession, AuthUser, DeviceSummary, UserProfile } from "../types/aerogen";

type SessionContextShape = {
  isReady: boolean;
  isAuthenticated: boolean;
  isWorking: boolean;
  user: AuthUser | null;
  profile: UserProfile;
  devices: DeviceSummary[];
  activeDeviceId: string;
  activeDeviceLabel: string;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  clearSessionError: () => void;
};

const defaultProfile: UserProfile = {
  displayName: "",
  phone: "",
  location: "",
  organization: "",
  supportPhone: ENV.supportPhone,
};

const fallbackDevice = (): DeviceSummary => ({
  id: ENV.deviceId,
  name: ENV.deviceLabel,
  status: "active",
});

const normalizeProfile = (raw: any, user: AuthUser | null): UserProfile => ({
  displayName: String(raw?.displayName || user?.name || user?.email?.split("@")[0] || "").trim(),
  phone: String(raw?.phone || "").trim(),
  location: String(raw?.location || "").trim(),
  organization: String(raw?.organization || "").trim(),
  supportPhone: String(raw?.supportPhone || ENV.supportPhone).trim(),
});

const SessionContext = createContext<SessionContextShape | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [devices, setDevices] = useState<DeviceSummary[]>([fallbackDevice()]);
  const [activeDeviceId, setActiveDeviceId] = useState(ENV.deviceId);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const applySession = useCallback(async (nextSession: AuthSession | null) => {
    setSession(nextSession);
    setApiAccessToken(nextSession?.accessToken || null);
    if (nextSession) {
      await sessionStorage.saveSession(nextSession);
      await analyticsService.flush();
    } else {
      await sessionStorage.clearSession();
    }
  }, []);

  const syncPreferences = useCallback(async (nextProfile: UserProfile, nextDeviceId: string) => {
    try {
      await backendApi.updatePreferencesRaw({
        profile: nextProfile,
        activeDeviceId: nextDeviceId,
      });
    } catch {
      // Local persistence is the source of truth if the backend is offline.
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const remoteDevices = await backendApi.fetchDevicesRaw();
      const normalized = remoteDevices.length ? remoteDevices : [fallbackDevice()];
      setDevices(normalized);
      if (!normalized.some((device) => device.id === activeDeviceId)) {
        const nextDeviceId = normalized[0]?.id || ENV.deviceId;
        setActiveDeviceId(nextDeviceId);
        await sessionStorage.saveActiveDeviceId(nextDeviceId);
      }
    } catch {
      setDevices([fallbackDevice()]);
    }
  }, [activeDeviceId]);

  const loadBootstrap = useCallback(
    async (user: AuthUser | null) => {
      const localProfile = await sessionStorage.loadProfile(normalizeProfile(defaultProfile, user));
      const localDeviceId = await sessionStorage.loadActiveDeviceId(ENV.deviceId);
      let nextProfile = normalizeProfile(localProfile, user);
      let nextDeviceId = localDeviceId;

      try {
        const bootstrap = await backendApi.fetchBootstrapRaw();
        const preferences = bootstrap?.preferences || {};
        if (preferences?.profile) {
          nextProfile = normalizeProfile(preferences.profile, user);
        }
        if (typeof preferences?.activeDeviceId === "string" && preferences.activeDeviceId.trim()) {
          nextDeviceId = preferences.activeDeviceId.trim();
        }
      } catch {
        // Keep local values if bootstrap is not available.
      }

      setProfile(nextProfile);
      setActiveDeviceId(nextDeviceId);
      await sessionStorage.saveProfile(nextProfile);
      await sessionStorage.saveActiveDeviceId(nextDeviceId);
    },
    [],
  );

  useEffect(() => {
    const restore = async () => {
      const saved = await sessionStorage.loadSession();
      let restored = saved;
      if (saved?.refreshToken) {
        try {
          restored = await backendApi.refresh(saved.refreshToken);
        } catch {
          restored = null;
        }
      }
      await applySession(restored);
      await loadBootstrap(restored?.user || null);
      if (restored) {
        await refreshDevices();
        await analyticsService.track({ event: "session_restored", category: "session" });
      }
      setIsReady(true);
    };
    void restore();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsWorking(true);
      setSessionError(null);
      try {
        const nextSession = await backendApi.login(email.trim().toLowerCase(), password);
        await applySession(nextSession);
        await loadBootstrap(nextSession.user);
        await refreshDevices();
        await analyticsService.track({ event: "login_success", category: "session" });
        return true;
      } catch (error) {
        setSessionError("No se pudo iniciar sesion. Revisa correo y clave.");
        await analyticsService.captureError(error, { area: "login" });
        return false;
      } finally {
        setIsWorking(false);
      }
    },
    [applySession, loadBootstrap, refreshDevices],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setIsWorking(true);
      setSessionError(null);
      try {
        const nextSession = await backendApi.register(name.trim(), email.trim().toLowerCase(), password);
        await applySession(nextSession);
        const nextProfile = normalizeProfile({ ...profile, displayName: name }, nextSession.user);
        setProfile(nextProfile);
        await sessionStorage.saveProfile(nextProfile);
        await syncPreferences(nextProfile, activeDeviceId);
        await refreshDevices();
        await analyticsService.track({ event: "register_success", category: "session" });
        return true;
      } catch (error) {
        setSessionError("No se pudo crear la cuenta. Usa otro correo o una clave mas segura.");
        await analyticsService.captureError(error, { area: "register" });
        return false;
      } finally {
        setIsWorking(false);
      }
    },
    [activeDeviceId, applySession, profile, refreshDevices, syncPreferences],
  );

  const logout = useCallback(async () => {
    setIsWorking(true);
    try {
      await analyticsService.track({ event: "logout", category: "session" });
      await backendApi.logout();
    } catch {
      // Logout should still clear local credentials.
    } finally {
      setApiAccessToken(null);
      await applySession(null);
      setIsWorking(false);
    }
  }, [applySession]);

  const selectDevice = useCallback(
    async (deviceId: string) => {
      setActiveDeviceId(deviceId);
      await sessionStorage.saveActiveDeviceId(deviceId);
      await syncPreferences(profile, deviceId);
      await analyticsService.track({ event: "device_selected", category: "interaction", deviceId });
    },
    [profile, syncPreferences],
  );

  const updateProfile = useCallback(
    async (nextProfile: UserProfile) => {
      const normalized = normalizeProfile(nextProfile, session?.user || null);
      setProfile(normalized);
      await sessionStorage.saveProfile(normalized);
      await syncPreferences(normalized, activeDeviceId);
      await analyticsService.track({ event: "profile_saved", category: "interaction", deviceId: activeDeviceId });
    },
    [activeDeviceId, session?.user, syncPreferences],
  );

  const activeDeviceLabel = useMemo(() => {
    const device = devices.find((item) => item.id === activeDeviceId);
    return device?.name || activeDeviceId || ENV.deviceLabel;
  }, [activeDeviceId, devices]);

  const value = useMemo<SessionContextShape>(
    () => ({
      isReady,
      isAuthenticated: Boolean(session?.accessToken),
      isWorking,
      user: session?.user || null,
      profile,
      devices,
      activeDeviceId,
      activeDeviceLabel,
      sessionError,
      login,
      register,
      logout,
      refreshDevices,
      selectDevice,
      updateProfile,
      clearSessionError: () => setSessionError(null),
    }),
    [
      activeDeviceId,
      activeDeviceLabel,
      devices,
      isReady,
      isWorking,
      login,
      logout,
      profile,
      refreshDevices,
      register,
      selectDevice,
      session,
      sessionError,
      updateProfile,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
};
