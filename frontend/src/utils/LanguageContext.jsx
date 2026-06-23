import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // Theme state: dark or light
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('edupath-theme') || 'dark';
  });

  // Language state: fr, en, or ar
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('edupath-lang') || 'fr';
  });

  // Effect to apply theme attributes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('edupath-theme', theme);
  }, [theme]);

  // Effect to apply language direction (RTL / LTR)
  useEffect(() => {
    const direction = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('edupath-lang', lang);
  }, [lang]);

  // Translation helper function
  const t = (key, variables = null) => {
    const langDict = translations[lang] || translations['fr'];
    let text = langDict[key];
    
    // Fallback to French if key is missing
    if (text === undefined) {
      const fallbackDict = translations['fr'];
      text = fallbackDict[key] || key;
    }

    // Replace variables (e.g. {count})
    if (variables && typeof text === 'string') {
      Object.keys(variables).forEach(variableKey => {
        text = text.replace(`{${variableKey}}`, variables[variableKey]);
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, theme, setTheme, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
