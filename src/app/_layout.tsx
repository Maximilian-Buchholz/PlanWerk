import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BottomTabBar, type TabKey } from '@/components/bottom-tab-bar';
import { PresenceProvider } from '@/lib/presence';
import { navigateToTab } from '@/lib/tab-navigation';
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
  if (pathname === '/teams') return 'teams';
  if (pathname === '/postfach') return 'postfach';
  if (pathname === '/calendar') return 'kalender';
  if (pathname === '/tasks/new-project') return null;
  if (pathname === '/tasks' || pathname.startsWith('/tasks/')) return 'tasks';
  // Anything else (login, register, message compose, profile) has no tab bar.
  return null;
}

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = activeTabForPathname(pathname);
  const unreadCount = useUnreadCount(pathname);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PresenceProvider>
      <AnimatedSplashOverlay />
      {/* The tab bar lives outside the Stack so it never slides along with
          screen transitions — only the content area above it animates. */}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="teams" options={tabScreenOptions} />
          <Stack.Screen name="postfach" options={tabScreenOptions} />
          <Stack.Screen name="calendar" options={tabScreenOptions} />
          <Stack.Screen name="tasks/index" options={tabScreenOptions} />
        </Stack>
      </View>
      {activeTab && (
        <BottomTabBar active={activeTab} badges={{ postfach: unreadCount }} onNavigate={(tab) => navigateToTab(router, activeTab, tab)} />
      )}
      </PresenceProvider>
    </GestureHandlerRootView>
  );
}
