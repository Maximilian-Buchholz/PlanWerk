import type { RealtimeChannel } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { supabase } from "./supabase";

const EMPTY: ReadonlySet<string> = new Set();
const PresenceContext = createContext<ReadonlySet<string>>(EMPTY);

/**
 * Tracks the signed-in user on a shared Realtime Presence channel while the
 * app is in the foreground, and exposes the ids of everyone currently online.
 * Nothing is stored in the database — presence disappears when a client
 * disconnects or goes to the background.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(EMPTY);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let joinedUserId: string | null = null;

    function leave() {
      if (channel) supabase.removeChannel(channel);
      channel = null;
      joinedUserId = null;
      setOnlineIds(EMPTY);
    }

    function join(userId: string) {
      if (joinedUserId === userId) return;
      leave();
      joinedUserId = userId;

      const current = supabase.channel("online-users", {
        config: { presence: { key: userId } },
      });
      current
        .on("presence", { event: "sync" }, () => {
          setOnlineIds(new Set(Object.keys(current.presenceState())));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && AppState.currentState === "active") {
            current.track({ online_at: new Date().toISOString() });
          }
        });
      channel = current;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) join(data.session.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) join(session.user.id);
      else leave();
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (!channel) return;
      if (state === "active") channel.track({ online_at: new Date().toISOString() });
      else channel.untrack();
    });

    return () => {
      authListener.subscription.unsubscribe();
      appStateSubscription.remove();
      leave();
    };
  }, []);

  return <PresenceContext.Provider value={onlineIds}>{children}</PresenceContext.Provider>;
}

/** Ids of all users currently online (including the current user). */
export function useOnlineUserIds(): ReadonlySet<string> {
  return useContext(PresenceContext);
}
