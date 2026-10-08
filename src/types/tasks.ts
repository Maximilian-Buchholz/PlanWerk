/**
 * Domain types mirroring schema.sql. Kept close to the DB column names so
 * Supabase query results (`select('*, phases(*), ...')`) can be typed
 * directly against these without a mapping layer.
 */

export type Priority = "low" | "medium" | "high";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_color: string;
  /** Status flags, set by the user on the profile screen and shown to friends. */
  is_do_not_disturb?: boolean;
  is_out_of_office?: boolean;
};

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  due_date: string | null;
};

export type Phase = {
  id: string;
  project_id: string;
  name: string;
  position: number;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  phase_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: Priority;
  is_done: boolean;
};

/**
 * A task as rendered by TaskCard: the raw row plus the relations the
 * dashboard query joins in (project/phase names, assignee profiles, and the
 * comment count).
 */
export type TaskWithRelations = Task & {
  project: Pick<Project, "id" | "name"> | null;
  phase: Phase | null;
  /** All phases of the task's project, ordered by position, for the phase bar. */
  projectPhases: Phase[];
  assignees: Profile[];
  commentCount: number;
};
