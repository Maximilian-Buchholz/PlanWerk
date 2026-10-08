import { supabase } from "./supabase";
import type { Profile } from "@/types/tasks";

export type NotificationType =
  | "friend_request"
  | "friend_request_accepted"
  | "direct_message"
  | "task_assigned"
  | "task_updated"
  | "team_added";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  sender: Profile | null;
  /** Only populated for sent messages (see `fetchSentMessages`) — the message's recipient. */
  recipient?: Profile | null;
  relatedFriendshipId: string | null;
};

/** Looks up a user by email via a SECURITY DEFINER RPC — `auth.users` isn't queryable from the client directly. */
export async function searchUserByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase.rpc("find_user_by_email", {
    search_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
  const row = data?.[0];
  return row ? { id: row.id, full_name: row.full_name, avatar_color: row.avatar_color } : null;
}

export async function sendFriendRequest(input: {
  requesterId: string;
  requesterName: string | null;
  addresseeId: string;
}) {
  // A declined request stays in the table with status "declined", and the pair is
  // presumably unique — clear it first so the user can be asked again.
  const { error: clearError } = await supabase
    .from("friendships")
    .delete()
    .eq("status", "declined")
    .or(
      `and(requester_id.eq.${input.requesterId},addressee_id.eq.${input.addresseeId}),and(requester_id.eq.${input.addresseeId},addressee_id.eq.${input.requesterId})`,
    );
  if (clearError) throw clearError;

  const { data: friendship, error } = await supabase
    .from("friendships")
    .insert({ requester_id: input.requesterId, addressee_id: input.addresseeId })
    .select("id")
    .single();
  if (error) throw error;

  const { error: notificationError } = await supabase.from("notifications").insert({
    recipient_id: input.addresseeId,
    sender_id: input.requesterId,
    type: "friend_request",
    title: `${input.requesterName ?? "Jemand"} möchte sich mit dir vernetzen`,
    related_friendship_id: friendship.id,
  });
  if (notificationError) throw notificationError;
}

export async function sendDirectMessage(input: {
  senderId: string;
  senderName: string | null;
  recipientId: string;
  body: string;
}) {
  const { error } = await supabase.from("notifications").insert({
    recipient_id: input.recipientId,
    sender_id: input.senderId,
    type: "direct_message",
    title: input.body,
  });
  if (error) throw error;
}

/** Direct messages the current user has sent, newest first — for the Postfach "Gesendet" tab. */
export async function fetchSentMessages(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, type, title, body, is_read, created_at, related_friendship_id, recipient:profiles!notifications_recipient_id_fkey(id, full_name, avatar_color)",
    )
    .eq("sender_id", userId)
    .eq("type", "direct_message")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at,
    sender: null,
    recipient: row.recipient ?? null,
    relatedFriendshipId: row.related_friendship_id,
  }));
}

/** Inserts one notification per recipient (skipping the sender, if included) — used for task assignment/updates. */
export async function notifyUsers(input: {
  recipientIds: string[];
  senderId: string;
  type: NotificationType;
  title: string;
}) {
  const recipients = [...new Set(input.recipientIds)].filter((id) => id !== input.senderId);
  if (recipients.length === 0) return;

  const { error } = await supabase.from("notifications").insert(
    recipients.map((recipientId) => ({
      recipient_id: recipientId,
      sender_id: input.senderId,
      type: input.type,
      title: input.title,
    })),
  );
  if (error) throw error;
}

export async function deleteNotifications(notificationIds: string[]) {
  const { error } = await supabase.from("notifications").delete().in("id", notificationIds);
  if (error) throw error;
}

export async function fetchFriends(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_color, is_do_not_disturb, is_out_of_office), addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_color, is_do_not_disturb, is_out_of_office)",
    )
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;

  return (data ?? [])
    .map((row: any) => (row.requester_id === userId ? row.addressee : row.requester))
    .filter((profile: Profile | null): profile is Profile => Boolean(profile));
}

/** Ends an accepted friendship, regardless of who sent the original request. */
export async function removeFriend(userId: string, friendId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`,
    )
    .select("id");
  if (error) throw error;
  // Row-level security turns a forbidden delete into "0 rows", not an error.
  if (!data || data.length === 0) {
    throw new Error("Freundschaft konnte nicht entfernt werden. Fehlt die Löschberechtigung in Supabase?");
  }
}

export async function fetchPendingSentRequests(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_color)")
    .eq("status", "pending")
    .eq("requester_id", userId);
  if (error) throw error;

  return (data ?? [])
    .map((row: any) => row.addressee as Profile | null)
    .filter((profile): profile is Profile => Boolean(profile));
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, type, title, body, is_read, created_at, related_friendship_id, sender:profiles!notifications_sender_id_fkey(id, full_name, avatar_color)",
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at,
    sender: row.sender ?? null,
    relatedFriendshipId: row.related_friendship_id,
  }));
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function respondToFriendRequest(input: {
  notification: AppNotification;
  accept: boolean;
  currentUserId: string;
  currentUserName: string | null;
}) {
  const { notification, accept, currentUserId, currentUserName } = input;
  if (!notification.relatedFriendshipId) {
    await markNotificationRead(notification.id);
    return;
  }

  const { error: friendshipError } = await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", notification.relatedFriendshipId);
  if (friendshipError) throw friendshipError;

  await markNotificationRead(notification.id);

  if (accept && notification.sender) {
    const { error: notifyBackError } = await supabase.from("notifications").insert({
      recipient_id: notification.sender.id,
      sender_id: currentUserId,
      type: "friend_request_accepted",
      title: `${currentUserName ?? "Jemand"} hat deine Anfrage angenommen`,
      related_friendship_id: notification.relatedFriendshipId,
    });
    if (notifyBackError) throw notifyBackError;
  }
}
