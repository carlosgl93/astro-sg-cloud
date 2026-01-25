import { useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';

interface LanguageSwitcherProps {
  currentLocale: 'es' | 'en';
  currentPath: string;
}

const LanguageSwitcher: FunctionalComponent<LanguageSwitcherProps> = ({ currentLocale, currentPath }) => {
  const [isOpen, setIsOpen] = useState(false);

  const languages = {
    es: { name: 'Español', flag: '🇪🇸' },
    en: { name: 'English', flag: '🇬🇧' },
  };

  const toggleDropdown = () => setIsOpen(!isOpen);

  const getAlternateUrl = (locale: 'es' | 'en') => {
    if (locale === 'es') {
      // Remove /en prefix for Spanish (default locale)
      return currentPath.replace(/^\/en/, '') || '/';
    } else {
      // Add /en prefix for English
      if (currentPath.startsWith('/en')) {
        return currentPath;
      }
      return `/en${currentPath === '/' ? '' : currentPath}`;
    }
  };

  return (
    <div class="relative inline-block text-left">
      <button
        type="button"
        onClick={toggleDropdown}
        class="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-slate-800 dark:text-slate-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span class="text-lg" aria-hidden="true">
          {languages[currentLocale].flag}
        </span>
        <span class="hidden sm:inline">{languages[currentLocale].name}</span>
        <svg
          class={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div class="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />

          {/* Dropdown menu */}
          <div class="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div class="py-1" role="menu" aria-orientation="vertical">
              {Object.entries(languages).map(([locale, { name, flag }]) => {
                const isCurrent = locale === currentLocale;
                return (
                  <a
                    key={locale}
                    href={getAlternateUrl(locale as 'es' | 'en')}
                    class={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      isCurrent
                        ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
                  >
                    <span class="text-lg" aria-hidden="true">
                      {flag}
                    </span>
                    <span>{name}</span>
                    {isCurrent && (
                      <svg
                        class="ml-auto w-4 h-4 text-blue-600 dark:text-blue-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitcher;
