import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BottomTabBar, type TabKey } from '@/components/bottom-tab-bar';
import { PresenceProvider } from '@/lib/presence';
import { navigateToTab } from '@/lib/tab-navigation';
import { ThemeProvider, useTheme } from '@/theme/theme-context';
import { useUnreadCount } from '@/lib/unread';

SplashScreen.preventAutoHideAsync();

// The 4 bottom-tab screens pass an `anim` param (set by navigateToTab in
// lib/tab-navigation.ts) so the slide direction matches whichever side of
// the tab bar the destination sits on, instead of a fixed push animation.
function tabScreenOptions({ route }: { route: { params?: { anim?: string } } }) {
  const anim = route.params?.anim;
  return {
    animation: (anim === 'left' ? 'slide_from_left' : 'slide_from_right') as
      | 'slide_from_left'
      | 'slide_from_right',
  };
}

/**
 * Which tab (if any) the bar should highlight for the current route, and
 * therefore whether it should render at all — screens like Login, Register
 * or "Projekt erstellen" have no tab bar, matching their previous per-screen
 * behavior before the bar was lifted up here.
 */
function activeTabForPathname(pathname: string): TabKey | null {
  if (pathname === '/profile') return null;
  if (pathname === '/teams') return 'teams';
  if (pathname === '/postfach') return 'postfach';
  if (pathname === '/calendar') return 'kalender';
  if (pathname === '/tasks/new-project') return null;
  if (pathname === '/tasks/thread') return null;
  if (pathname === '/tasks' || pathname.startsWith('/tasks/')) return 'tasks';
  // Anything else (login, register, message compose) has no tab bar.
  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}

function ThemedRoot() {
  const { colors, isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = activeTabForPathname(pathname);
  const showTabBar = activeTab !== null || pathname === '/profile';
  const unreadCount = useUnreadCount(pathname);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.warmCream).catch(() => {});
  }, [colors.warmCream]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.warmCream }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PresenceProvider>
      <AnimatedSplashOverlay />
      {/* The tab bar lives outside the Stack so it never slides along with
          screen transitions — only the content area above it animates. */}
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            // No swipe-from-the-edge "back" — it fired too easily while swiping cards or scrolling the board.
            gestureEnabled: false,
            contentStyle: { backgroundColor: colors.warmCream },
          }}
        >
          <Stack.Screen name="teams" options={tabScreenOptions} />
          <Stack.Screen name="postfach" options={tabScreenOptions} />
          <Stack.Screen name="calendar" options={tabScreenOptions} />
          <Stack.Screen name="tasks/index" options={tabScreenOptions} />
        </Stack>
      </View>
      {showTabBar && (
        <BottomTabBar active={activeTab} badges={{ postfach: unreadCount }} onNavigate={(tab) => navigateToTab(router, activeTab, tab)} />
      )}
      </PresenceProvider>
    </GestureHandlerRootView>
  );
}
