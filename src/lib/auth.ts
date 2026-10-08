import { supabase } from "./supabase";
import type { Profile } from "@/types/tasks";

export async function registerUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        display_name: name.trim(),
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

/** The email lives on `auth.users`, not `public.profiles` — fetched separately. */
export async function getCurrentUserEmail(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.email ?? null;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_color, is_do_not_disturb, is_out_of_office")
    .eq("id", userId)
    // .maybeSingle() instead of .single(): a user can be authenticated but
    // still have no profiles row yet (e.g. the account was created before
    // the on_auth_user_created trigger existed) — that should degrade to
    // "no profile", not throw.
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProfileStatus(
  userId: string,
  status: { is_do_not_disturb?: boolean; is_out_of_office?: boolean },
) {
  const { error } = await supabase.from("profiles").update(status).eq("id", userId);
  if (error) throw error;
}

export async function signInUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}