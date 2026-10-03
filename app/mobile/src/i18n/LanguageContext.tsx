import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppLanguage, translate } from "./translations";

type LanguageContextShape = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextShape | null>(null);
const LANGUAGE_KEY = "aurora.language";

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<AppLanguage>("es");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((saved) => {
        if (saved === "es" || saved === "en" || saved === "qu" || saved === "zh") {
          setLanguage(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  const persistLanguage = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  };

  const value = useMemo<LanguageContextShape>(
    () => ({
      language,
      setLanguage: persistLanguage,
      t: (key, params) => translate(language, key, params),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useI18n = () => {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useI18n must be used inside LanguageProvider");
  }
  return value;
};
