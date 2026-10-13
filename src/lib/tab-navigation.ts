import type { useRouter } from "expo-router";

import type { TabKey } from "@/components/bottom-tab-bar";

type Router = ReturnType<typeof useRouter>;

/** Left-to-right order of the tabs as they appear in the bottom tab bar. */
const TAB_ORDER: TabKey[] = ["teams", "postfach", "tasks", "kalender"];

const TAB_PATHS: Record<TabKey, string> = {
  teams: "/teams",
  postfach: "/postfach",
  tasks: "/tasks",
  kalender: "/calendar",
};

/**
 * Navigates between tabs with a slide direction that matches their position
 * in the bottom tab bar, so switching tabs always feels like moving along
 * one continuous horizontal strip instead of a generic push animation.
 */
export function navigateToTab(router: Router, from: TabKey | null, to: TabKey) {
  if (from === to) return;

  const fromIndex = from ? TAB_ORDER.indexOf(from) : -1;
  const toIndex = TAB_ORDER.indexOf(to);
  const anim = toIndex < fromIndex ? "left" : "right";
  const pathname = TAB_PATHS[to];

  // Leaving a tab-less screen (profile) replaces it so "back" doesn't return there.
  if (to === "tasks" || from === null) {
    router.replace({ pathname, params: { anim } } as never);
  } else {
    router.push({ pathname, params: { anim } } as never);
  }
}
