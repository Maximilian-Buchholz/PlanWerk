import { supabase } from "./supabase";
import type { Profile } from "@/types/tasks";

export type TaskActivityType =
  | "task_created"
  | "assignee_added"
  | "assignee_removed"
  | "phase_changed"
  | "marked_done"
  | "marked_open";

export type TaskActivityData = {
  /** assignee_added / assignee_removed: the person concerned. */
  userId?: string;
  userName?: string | null;
  /** phase_changed: names of the old and new phase. */
  from?: string | null;
  to?: string | null;
};

export type ThreadComment = {
  kind: "comment";
  id: string;
  createdAt: string;
  author: Profile | null;
  content: string;
  likeCount: number;
  likedByMe: boolean;
};

export type ThreadActivity = {
  kind: "activity";
  id: string;
  createdAt: string;
  actor: Profile | null;
  type: TaskActivityType;
  data: TaskActivityData;
};

export type ThreadEntry = ThreadComment | ThreadActivity;

async function fetchProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_color")
    .in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((profile: Profile) => [profile.id, profile]));
}

/** All comments and activity entries of a task, newest first. */
export async function fetchTaskThread(taskId: string, currentUserId: string | null): Promise<ThreadEntry[]> {
  const [commentsResult, activityResult] = await Promise.all([
    supabase
      .from("task_comments")
      .select("id, user_id, content, created_at")
      .eq("task_id", taskId),
    supabase
      .from("task_activity")
      .select("id, actor_id, type, data, created_at")
      .eq("task_id", taskId),
  ]);
  if (commentsResult.error) throw commentsResult.error;
  if (activityResult.error) throw activityResult.error;

  const comments = commentsResult.data ?? [];
  const activity = activityResult.data ?? [];

  const commentIds = comments.map((comment) => comment.id);
  const likesResult = commentIds.length
    ? await supabase.from("task_comment_likes").select("comment_id, user_id").in("comment_id", commentIds)
    : { data: [], error: null };
  if (likesResult.error) throw likesResult.error;

  const profiles = await fetchProfiles([
    ...comments.map((comment) => comment.user_id),
    ...activity.map((entry) => entry.actor_id).filter((id): id is string => Boolean(id)),
  ]);

  const likesByComment = new Map<string, string[]>();
  for (const like of likesResult.data ?? []) {
    likesByComment.set(like.comment_id, [...(likesByComment.get(like.comment_id) ?? []), like.user_id]);
  }

  const entries: ThreadEntry[] = [
    ...comments.map(
      (comment): ThreadComment => {
        const likers = likesByComment.get(comment.id) ?? [];
        return {
          kind: "comment",
          id: comment.id,
          createdAt: comment.created_at,
          author: profiles.get(comment.user_id) ?? null,
          content: comment.content,
          likeCount: likers.length,
          likedByMe: currentUserId ? likers.includes(currentUserId) : false,
        };
      },
    ),
    ...activity.map(
      (entry): ThreadActivity => ({
        kind: "activity",
        id: entry.id,
        createdAt: entry.created_at,
        actor: entry.actor_id ? (profiles.get(entry.actor_id) ?? null) : null,
        type: entry.type,
        data: (entry.data ?? {}) as TaskActivityData,
      }),
    ),
  ];

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addTaskComment(input: { taskId: string; userId: string; content: string }) {
  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: input.taskId, user_id: input.userId, content: input.content });
  if (error) throw error;
}

export async function setCommentLike(input: { commentId: string; userId: string; liked: boolean }) {
  const query = input.liked
    ? supabase.from("task_comment_likes").insert({ comment_id: input.commentId, user_id: input.userId })
    : supabase
        .from("task_comment_likes")
        .delete()
        .eq("comment_id", input.commentId)
        .eq("user_id", input.userId);
  const { error } = await query;
  if (error) throw error;
}

/**
 * Records an entry in a task's history. Never throws: a failed log entry must not
 * break the action (moving a task, assigning someone, …) that caused it.
 */
export async function logTaskActivity(input: {
  taskId: string;
  type: TaskActivityType;
  data?: TaskActivityData;
}) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const actorId = sessionData.session?.user.id;
    if (!actorId) return;

    const { error } = await supabase.from("task_activity").insert({
      task_id: input.taskId,
      actor_id: actorId,
      type: input.type,
      data: input.data ?? {},
    });
    if (error) throw error;
  } catch (error) {
    console.warn("Task-Verlauf konnte nicht gespeichert werden:", error);
  }
}
