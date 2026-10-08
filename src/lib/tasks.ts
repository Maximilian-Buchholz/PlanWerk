import { notifyUsers } from "./friends";
import { supabase } from "./supabase";
import type { Phase, Priority, Profile, Project, TaskWithRelations } from "@/types/tasks";

const DEFAULT_PHASE_NAMES = ["Briefing", "Planung", "Umsetzung", "Review", "Abschluss"];

/** Assigning someone to a task makes them a project member if they aren't one yet. */
async function ensureProjectMembers(projectId: string, userIds: string[]) {
  if (userIds.length === 0) return;

  const { data: existing, error: existingError } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .in("user_id", userIds);
  if (existingError) throw existingError;

  const existingIds = new Set((existing ?? []).map((row) => row.user_id));
  const missing = userIds.filter((id) => !existingIds.has(id));
  if (missing.length === 0) return;

  const { error } = await supabase
    .from("project_members")
    .insert(missing.map((userId) => ({ project_id: projectId, user_id: userId, role: "member" })));
  if (error) throw error;
}

/** Creates a new project, its 5 standard phases, and makes the creator its owner. */
export async function createProject(input: {
  userId: string;
  name: string;
  dueDate: string | null;
}): Promise<Pick<Project, "id" | "name" | "due_date">> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ owner_id: input.userId, name: input.name, due_date: input.dueDate })
    .select("id, name, due_date")
    .single();

  if (projectError) throw projectError;

  const { error: phasesError } = await supabase.from("phases").insert(
    DEFAULT_PHASE_NAMES.map((name, index) => ({
      project_id: project.id,
      name,
      position: index + 1,
    })),
  );
  if (phasesError) throw phasesError;

  const { error: memberError } = await supabase
    .from("project_members")
    .insert({ project_id: project.id, user_id: input.userId, role: "owner" });
  if (memberError) throw memberError;

  return project;
}

export type ProjectSummary = {
  id: string;
  name: string;
  dueDate: string | null;
  /** The earliest phase that still has an open task, or the last phase once everything is done. */
  currentPhase: Phase | null;
  totalTasks: number;
  doneTasks: number;
  members: Profile[];
  openCommentsCount: number;
};

/** Project cards for the dashboard: one summary row per project the user belongs to. */
export async function fetchProjectsOverview(userId: string): Promise<ProjectSummary[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;

  const projectIds = [...new Set((memberships ?? []).map((row) => row.project_id))];
  if (projectIds.length === 0) return [];

  const [
    { data: projects, error: projectsError },
    { data: phaseRows, error: phasesError },
    { data: taskRows, error: tasksError },
    { data: memberRows, error: membersError },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, due_date").in("id", projectIds),
    supabase.from("phases").select("*").in("project_id", projectIds).order("position", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, project_id, phase_id, is_done, task_comments(count)")
      .in("project_id", projectIds),
    supabase
      .from("project_members")
      .select("project_id, profiles(id, full_name, avatar_color)")
      .in("project_id", projectIds),
  ]);

  if (projectsError) throw projectsError;
  if (phasesError) throw phasesError;
  if (tasksError) throw tasksError;
  if (membersError) throw membersError;

  const phasesByProject = new Map<string, Phase[]>();
  for (const phase of phaseRows ?? []) {
    const list = phasesByProject.get(phase.project_id) ?? [];
    list.push(phase);
    phasesByProject.set(phase.project_id, list);
  }

  const membersByProject = new Map<string, Profile[]>();
  for (const row of memberRows ?? []) {
    const profile = row.profiles as unknown as Profile | null;
    if (!profile) continue;
    const list = membersByProject.get(row.project_id) ?? [];
    list.push(profile);
    membersByProject.set(row.project_id, list);
  }

  return (projects ?? []).map((project) => {
    const phases = phasesByProject.get(project.id) ?? [];
    const tasks = (taskRows ?? []).filter((task: any) => task.project_id === project.id);
    const doneTasks = tasks.filter((task: any) => task.is_done).length;
    const openCommentsCount = tasks.reduce(
      (sum: number, task: any) => sum + (task.task_comments?.[0]?.count ?? 0),
      0,
    );

    const firstOpenPhase = phases.find((phase) =>
      tasks.some((task: any) => task.phase_id === phase.id && !task.is_done),
    );
    const currentPhase = firstOpenPhase ?? phases[phases.length - 1] ?? null;

    return {
      id: project.id,
      name: project.name,
      dueDate: project.due_date,
      currentPhase,
      totalTasks: tasks.length,
      doneTasks,
      members: membersByProject.get(project.id) ?? [],
      openCommentsCount,
    };
  });
}

export type ProjectWithTasks = {
  project: Pick<Project, "id" | "name" | "due_date">;
  phases: Phase[];
  members: Profile[];
  tasks: TaskWithRelations[];
};

/** Full data for the Project-Detail screen: phases, members and every task, in one shot. */
export async function fetchProjectWithTasks(projectId: string): Promise<ProjectWithTasks | null> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, due_date")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;

  const [
    { data: phases, error: phasesError },
    { data: memberRows, error: membersError },
    { data: taskRows, error: tasksError },
  ] = await Promise.all([
    supabase.from("phases").select("*").eq("project_id", projectId).order("position", { ascending: true }),
    supabase.from("project_members").select("profiles(id, full_name, avatar_color)").eq("project_id", projectId),
    supabase
      .from("tasks")
      .select(
        "*, project:projects(id, name), phase:phases(*), task_assignees(profiles(id, full_name, avatar_color)), task_comments(count)",
      )
      .eq("project_id", projectId)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  if (phasesError) throw phasesError;
  if (membersError) throw membersError;
  if (tasksError) throw tasksError;

  const members = (memberRows ?? [])
    .map((row) => row.profiles as unknown as Profile)
    .filter((profile): profile is Profile => Boolean(profile));

  const tasks: TaskWithRelations[] = (taskRows ?? []).map((row: any) => ({
    id: row.id,
    project_id: row.project_id,
    phase_id: row.phase_id,
    created_by: row.created_by,
    title: row.title,
    description: row.description,
    due_date: row.due_date,
    priority: row.priority,
    is_done: row.is_done,
    project: row.project ?? null,
    phase: row.phase ?? null,
    projectPhases: phases ?? [],
    assignees: (row.task_assignees ?? []).map((assignee: any) => assignee.profiles).filter(Boolean),
    commentCount: row.task_comments?.[0]?.count ?? 0,
  }));

  return { project, phases: phases ?? [], members, tasks };
}

export async function createTask(input: {
  projectId: string;
  phaseId: string | null;
  createdBy: string;
  createdByName: string | null;
  title: string;
  description: string;
  dueDate: string | null;
  priority: Priority;
  assigneeIds: string[];
}) {
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: input.projectId,
      phase_id: input.phaseId,
      created_by: input.createdBy,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate,
      priority: input.priority,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.assigneeIds.length > 0) {
    await ensureProjectMembers(input.projectId, input.assigneeIds);

    const { error: assigneeError } = await supabase.from("task_assignees").insert(
      input.assigneeIds.map((userId) => ({ task_id: task.id, user_id: userId })),
    );
    if (assigneeError) throw assigneeError;

    await notifyUsers({
      recipientIds: input.assigneeIds,
      senderId: input.createdBy,
      type: "task_assigned",
      title: `${input.createdByName ?? "Jemand"} hat dir die Aufgabe „${input.title}“ zugewiesen`,
    });
  }

  return task;
}

export async function updateTask(
  taskId: string,
  input: {
    projectId: string;
    editedBy: string;
    editedByName: string | null;
    title: string;
    description: string;
    dueDate: string | null;
    priority: Priority;
    phaseId: string | null;
    assigneeIds: string[];
  },
) {
  const { data: existingAssignees, error: existingError } = await supabase
    .from("task_assignees")
    .select("user_id")
    .eq("task_id", taskId);
  if (existingError) throw existingError;
  const previousAssigneeIds = new Set((existingAssignees ?? []).map((row) => row.user_id));

  const { error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate,
      priority: input.priority,
      phase_id: input.phaseId,
    })
    .eq("id", taskId);
  if (error) throw error;

  const { error: deleteError } = await supabase.from("task_assignees").delete().eq("task_id", taskId);
  if (deleteError) throw deleteError;

  if (input.assigneeIds.length > 0) {
    await ensureProjectMembers(input.projectId, input.assigneeIds);

    const { error: assigneeError } = await supabase.from("task_assignees").insert(
      input.assigneeIds.map((userId) => ({ task_id: taskId, user_id: userId })),
    );
    if (assigneeError) throw assigneeError;
  }

  const newlyAssigned = input.assigneeIds.filter((id) => !previousAssigneeIds.has(id));
  const stillAssigned = input.assigneeIds.filter((id) => previousAssigneeIds.has(id));

  if (newlyAssigned.length > 0) {
    await notifyUsers({
      recipientIds: newlyAssigned,
      senderId: input.editedBy,
      type: "task_assigned",
      title: `${input.editedByName ?? "Jemand"} hat dir die Aufgabe „${input.title}“ zugewiesen`,
    });
  }

  if (stillAssigned.length > 0) {
    await notifyUsers({
      recipientIds: stillAssigned,
      senderId: input.editedBy,
      type: "task_updated",
      title: `${input.editedByName ?? "Jemand"} hat die Aufgabe „${input.title}“ aktualisiert`,
    });
  }
}

/** Tasks across every project the user belongs to — used for the dashboard's "HEUTE FÄLLIG" section. */
export async function fetchDashboardTasks(
  userId: string,
): Promise<{ projectsCount: number; tasks: TaskWithRelations[] }> {
  const { data: memberships, error: membershipError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);

  if (membershipError) throw membershipError;

  const projectIds = [...new Set((memberships ?? []).map((row) => row.project_id))];
  if (projectIds.length === 0) {
    return { projectsCount: 0, tasks: [] };
  }

  const { data: phaseRows, error: phasesError } = await supabase
    .from("phases")
    .select("*")
    .in("project_id", projectIds)
    .order("position", { ascending: true });

  if (phasesError) throw phasesError;

  const phasesByProject = new Map<string, Phase[]>();
  for (const phase of phaseRows ?? []) {
    const list = phasesByProject.get(phase.project_id) ?? [];
    list.push(phase);
    phasesByProject.set(phase.project_id, list);
  }

  const { data: taskRows, error: tasksError } = await supabase
    .from("tasks")
    .select(
      "*, project:projects(id, name), phase:phases(*), task_assignees(profiles(id, full_name, avatar_color)), task_comments(count)",
    )
    .in("project_id", projectIds)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (tasksError) throw tasksError;

  const tasks: TaskWithRelations[] = (taskRows ?? []).map((row: any) => ({
    id: row.id,
    project_id: row.project_id,
    phase_id: row.phase_id,
    created_by: row.created_by,
    title: row.title,
    description: row.description,
    due_date: row.due_date,
    priority: row.priority,
    is_done: row.is_done,
    project: row.project ?? null,
    phase: row.phase ?? null,
    projectPhases: phasesByProject.get(row.project_id) ?? [],
    assignees: (row.task_assignees ?? [])
      .map((assignee: any) => assignee.profiles)
      .filter(Boolean),
    commentCount: row.task_comments?.[0]?.count ?? 0,
  }));

  return { projectsCount: projectIds.length, tasks };
}

export async function setTaskDone(taskId: string, isDone: boolean) {
  const { error } = await supabase.from("tasks").update({ is_done: isDone }).eq("id", taskId);
  if (error) throw error;
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

/** Deletes a project along with every task (and its assignees/comments), its phases and its memberships. */
export async function deleteProject(projectId: string) {
  const { data: taskRows, error: taskFetchError } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", projectId);
  if (taskFetchError) throw taskFetchError;

  const taskIds = (taskRows ?? []).map((row) => row.id);
  if (taskIds.length > 0) {
    const { error: assigneesError } = await supabase.from("task_assignees").delete().in("task_id", taskIds);
    if (assigneesError) throw assigneesError;

    const { error: commentsError } = await supabase.from("task_comments").delete().in("task_id", taskIds);
    if (commentsError) throw commentsError;

    const { error: tasksError } = await supabase.from("tasks").delete().in("id", taskIds);
    if (tasksError) throw tasksError;
  }

  const { error: membersError } = await supabase.from("project_members").delete().eq("project_id", projectId);
  if (membersError) throw membersError;

  const { error: phasesError } = await supabase.from("phases").delete().eq("project_id", projectId);
  if (phasesError) throw phasesError;

  // `.select("id")` after delete so a 0-row result (e.g. blocked by RLS,
  // which fails silently rather than throwing) surfaces as an explicit
  // error instead of pretending the project was deleted.
  const { data: deletedProject, error: projectError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select("id");
  if (projectError) throw projectError;
  if (!deletedProject || deletedProject.length === 0) {
    throw new Error(
      "Projekt konnte nicht gelöscht werden (keine Berechtigung oder Projekt existiert nicht mehr).",
    );
  }
}
