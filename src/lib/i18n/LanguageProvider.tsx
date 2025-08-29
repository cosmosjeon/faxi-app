"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Locale } from "date-fns";
import { useAuthStore } from "@/stores/auth.store";
import { getUserSettings, updateUserSettings } from "@/features/settings/api";
import { enUS, ko as koLocale } from "date-fns/locale";
import en from "./dictionaries/en";
import ko from "./dictionaries/ko";

type SupportedLanguage = "ko" | "en";

type Dictionary = typeof en;

interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage, opts?: { persist?: boolean }) => void;
  t: (key: keyof Dictionary | string, params?: Record<string, string | number>) => string;
  dateLocale: Locale;
  localeCode: string; // e.g., "ko-KR" | "en-US"
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "faxi.language";

function getInitialLanguage(): SupportedLanguage {
  // SSR/CSR 초기 렌더 일치 보장: 항상 "ko"로 시작하고 클라이언트에서 동기화한다
  return "ko";
}

function resolve(dict: Dictionary, key: string): string | undefined {
  // support dot-notation like "profile.title"
  const parts = key.split(".");
  let cur: any = dict;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore();
  const [language, setLanguageState] = useState<SupportedLanguage>(getInitialLanguage);

  // 서버 저장값 동기화 (로그인 후 1회)
  useEffect(() => {
    const sync = async () => {
      try {
        if (!profile?.id) return;
        const settings = await getUserSettings(profile.id);
        const serverLang = (settings as any)?.language as SupportedLanguage | undefined;
        if (serverLang && serverLang !== language) {
          setLanguageState(serverLang);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, serverLang);
          }
        }
      } catch {}
    };
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const setLanguage = useCallback(
    (lang: SupportedLanguage, opts?: { persist?: boolean }) => {
      setLanguageState(lang);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, lang);
        // 즉시 <html lang> 힌트 업데이트 (비차단)
        try {
          document.documentElement.setAttribute("lang", lang === "en" ? "en" : "ko");
        } catch {}
      }
      if (opts?.persist !== false && profile?.id) {
        // 서버에도 저장 (비동기, 대기하지 않음)
        updateUserSettings(profile.id, { language: lang }).catch(() => {});
      }
    },
    [profile?.id]
  );

  // 클라이언트에서만 초기 언어 동기화 (localStorage -> navigator 순)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      const nav = window.navigator?.language?.toLowerCase() ?? "ko";
      const fallback = nav.startsWith("en") ? "en" : "ko";
      const clientLang: SupportedLanguage = stored === "ko" || stored === "en" ? stored : (fallback as SupportedLanguage);
      if (clientLang !== language) {
        // 서버 저장은 하지 않음 (사용자 명시 변경 시에만 저장)
        setLanguage(clientLang, { persist: false });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dict = language === "en" ? en : ko;

  const t = useCallback(
    (key: keyof Dictionary | string, params?: Record<string, string | number>) => {
      const raw = resolve(dict, String(key)) ?? resolve(ko, String(key)) ?? String(key);
      if (!params) return raw;
      return Object.entries(params).reduce((acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)), raw);
    },
    [dict]
  );

  const value = useMemo<I18nContextValue>(() => {
    const dateLocale = language === "en" ? enUS : koLocale;
    const localeCode = language === "en" ? "en-US" : "ko-KR";
    return { language, setLanguage, t, dateLocale, localeCode };
  }, [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}


