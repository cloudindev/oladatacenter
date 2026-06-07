"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

export type Language = "en" | "es"

interface LanguageContextProps {
  lang: Language
  setLang: (lang: Language) => void
  t: (enText: string, esText?: string) => string
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined)

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>("en")

  // Function to translate based on current language
  // If no esText is provided, it falls back to enText
  const t = (enText: string, esText?: string) => {
    if (lang === "es" && esText) {
      return esText
    }
    return enText
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
