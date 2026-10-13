import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Appearance, useColorScheme, View } from 'react-native';

import { darkColors, lightColors, type Palette } from '@/theme/colors';

const STORAGE_KEY = 'planwerk.theme';

type StoredTheme = 'light' | 'dark';

function readStoredTheme(): StoredTheme | null {
  try {
    const value = Storage.getItemSync(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

type ThemeContextValue = {
  colors: Palette;
  isDark: boolean;
  setDarkMode: (enabled: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  setDarkMode: () => {},
});

/**
 * Provides the active palette. Until the user flips the switch in the profile,
 * the device setting decides; afterwards the explicit choice is persisted.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [stored, setStored] = useState<StoredTheme | null>(readStoredTheme);

  const isDark = stored ? stored === 'dark' : systemScheme === 'dark';

  // Keeps native chrome (keyboard, date pickers, alerts) in step with the app.
  useEffect(() => {
    Appearance.setColorScheme(stored ?? 'unspecified');
  }, [stored]);

  // Fade the whole app out, swap the palette while it is invisible, fade back in.
  const [opacity] = useState(() => new Animated.Value(1));

  const setDarkMode = useCallback(
    (enabled: boolean) => {
      const next: StoredTheme = enabled ? 'dark' : 'light';
      opacity.stopAnimation();
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setStored(next);
        try {
          Storage.setItemSync(STORAGE_KEY, next);
        } catch (error) {
          console.error('Theme konnte nicht gespeichert werden:', error);
        }
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    },
    [opacity],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, setDarkMode }),
    [isDark, setDarkMode],
  );

  const palette = value.colors;

  return (
    <ThemeContext.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: palette.warmCream }}>
        <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}
