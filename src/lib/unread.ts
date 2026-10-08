import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { supabase } from "./supabase";

/**
 * Number of unread notifications (messages, friend requests, task updates)
 * for the signed-in user. Refreshes on app resume, whenever `refreshKey`
 * changes (e.g. the route), and live via Realtime when the `notifications`
 * table is part of the `supabase_realtime` publication.
 */
export function useUnreadCount(refreshKey?: unknown): number {
  const [userId, setUserId] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUserId(session?.user.id ?? null),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    const { count: unread, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    if (!error) setCount(unread ?? 0);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!userId) return;

    const channel: RealtimeChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      supabase.removeChannel(channel);
      appState.remove();
    };
  }, [userId, refresh]);

  return count;
}
