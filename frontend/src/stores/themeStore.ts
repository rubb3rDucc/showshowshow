import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  initializeTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: 'light',

      setTheme: (theme: Theme) => {
        set({ theme });
        applyTheme(theme);
      },

      initializeTheme: () => {
        const { theme } = get();
        applyTheme(theme);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
          if (get().theme === 'system') {
            applyTheme('system');
          }
        };
        mediaQuery.addEventListener('change', handleChange);
      },
    }),
    {
      name: 'theme-preference',
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  let resolvedTheme: 'light' | 'dark';

  if (theme === 'system') {
    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } else {
    resolvedTheme = theme;
  }

  root.setAttribute('data-theme', resolvedTheme);
  useThemeStore.setState({ resolvedTheme });
}
