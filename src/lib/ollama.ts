import type { Priority } from "@/types/tasks";

const OLLAMA_BASE_URL =
  process.env.EXPO_PUBLIC_OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.EXPO_PUBLIC_OLLAMA_MODEL ?? "qwen3.5:4b";

export type TaskIntent = {
  action:
    | "create_task"
    | "create_project"
    | "add_tasks"
    | "send_message"
    | "add_friend"
    | "remove_friend"
    | "delete_project"
    | "clarify"
    | "chat"
    | "friend_status";
  title: string | null;
  projectName: string | null;
  /** Only set when action is "create_project" or "add_tasks" — the tasks mentioned. */
  taskTitles: string[] | null;
  dueDate: string | null;
  priority: Priority;
  /** Set when action is "friend_status", "send_message" or "remove_friend" — the friend being referred to. */
  friendName: string | null;
  /** Only set when action is "send_message" — what to tell the friend. */
  messageBody: string | null;
  /** Only set when action is "add_friend" — the email address to search for. */
  email: string | null;
  message: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** POSTs one /api/chat request with forced JSON output and no "thinking" phase (which otherwise adds 20s+ per call). */
async function callOllamaJson(
  messages: { role: string; content: string }[],
): Promise<any> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      format: "json",
      stream: false,
      think: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama ist nicht erreichbar (${response.status}). Läuft "ollama serve" und ist OLLAMA_BASE_URL korrekt?`,
    );
  }

  const data = await response.json();
  const content: string = data?.message?.content ?? "";
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(
      "Die Antwort des Modells war kein gültiges JSON. Bitte versuch es nochmal.",
    );
  }
}

function systemPrompt(projectNames: string[], friendNames: string[]): string {
  return [
    "Du bist der KI-Assistent einer Projekt-Management-App. Du kannst: (1) ganz normal unterhalten, (2) einzelne Tasks anlegen, (3) ganze Projekte samt Tasks anlegen, (4) mehrere Tasks zu einem bereits vorhandenen Projekt hinzufügen, (5) erkennen, wenn nach der Erreichbarkeit/dem Online-Status eines Freundes gefragt wird, (6) eine Nachricht an einen Freund schicken, (7) einen Freund per E-Mail hinzufügen, (8) einen Freund entfernen und (9) ein vorhandenes Projekt löschen.",
    `Heutiges Datum: ${todayIso()} (nutze das, um relative Angaben wie "morgen" oder "in 3 Tagen" umzurechnen).`,
    projectNames.length > 0
      ? `Vorhandene Projekte: ${projectNames.join(", ")}.`
      : "Es gibt noch keine Projekte.",
    friendNames.length > 0
      ? `Freunde des Nutzers: ${friendNames.join(", ")}.`
      : "Der Nutzer hat noch keine Freunde hinzugefügt.",
    "Antworte NUR mit JSON nach exakt diesem Schema, ohne Markdown-Codeblock, ohne weiteren Text:",
    '{"action": "create_task" | "create_project" | "add_tasks" | "send_message" | "add_friend" | "remove_friend" | "delete_project" | "clarify" | "chat" | "friend_status", "title": string|null, "projectName": string|null, "taskTitles": string[]|null, "dueDate": string|null (YYYY-MM-DD), "priority": "low"|"medium"|"high", "friendName": string|null, "messageBody": string|null, "email": string|null, "message": string}',
    "Regeln:",
    '- action ist "create_project", wenn der Nutzer ein NEUES Projekt anlegen will (ein Name dafür ist erkennbar, der NICHT in der Projektliste steht), optional mit ein oder mehreren Tasks darin — setze projectName und taskTitles (Liste der genannten Task-Titel, leeres Array falls keine genannt wurden).',
    '- action ist "add_tasks", wenn der Nutzer MEHRERE neue Tasks zu einem BEREITS VORHANDENEN Projekt aus der Liste hinzufügen will — setze projectName (muss exakt einem vorhandenen Projekt entsprechen) und taskTitles (alle genannten Titel, mindestens 2).',
    '- action ist "create_task", wenn der Nutzer GENAU EINEN einzelnen Task in einem BEREITS VORHANDENEN Projekt aus der Liste anlegen will UND ein Titel UND genau EIN passendes Projekt erkennbar sind.',
    '- action ist "send_message", wenn der Nutzer einem Freund etwas ausrichten/schreiben/mitteilen möchte. Setze friendName (der genannte Name) und messageBody (der Nachrichtentext, den der Freund lesen soll — formuliere ihn notfalls aus dem Kontext des Nutzers, aber bleib nah am Gesagten).',
    '- action ist "add_friend", wenn der Nutzer einen neuen Freund/Kontakt per E-Mail hinzufügen möchte. Setze email auf die genannte E-Mail-Adresse.',
    '- action ist "remove_friend", wenn der Nutzer einen Freund entfernen/löschen/entfreunden möchte. Setze friendName auf den genannten Namen.',
    '- action ist "delete_project", wenn der Nutzer ein BEREITS VORHANDENES Projekt aus der Liste löschen/entfernen will. Setze projectName exakt auf den Namen aus der Projektliste. Nur einzelne Tasks löschen ist NICHT möglich — dann action "chat" und kurz erklären, dass das in der App geht.',
    '- action ist "friend_status", wenn gefragt wird, ob/wie erreichbar oder ob eine Person aus der Freundesliste gerade ONLINE ist (z. B. "ist X online?", "ist X erreichbar?"). Setze friendName auf den genannten Namen (exakt wie in der Freundesliste, falls zuordenbar). WICHTIG: Du kennst den tatsächlichen Status nicht — erfinde ihn NICHT. message ist in diesem Fall nur ein Platzhalter wie "Ich schaue nach.", die echte Antwort liefert die App.',
    '- action ist "clarify", wenn der Nutzer erkennbar eine der obigen Aktionen will, aber etwas Nötiges fehlt (z. B. Titel, Projekt, E-Mail, Nachrichtentext) oder nicht eindeutig zuordenbar ist.',
    '- action ist "chat" bei allem anderen (Begrüßung, Smalltalk, allgemeine Fragen, Dank usw.) — antworte dann ganz normal und freundlich auf Deutsch im message-Feld, alle anderen Felder bleiben null, priority "medium".',
    "- friendName bei send_message/remove_friend/friend_status ist der vom Nutzer genannte Name (auch nur ein Vorname), unverändert übernommen — die App gleicht ihn selbst gegen die Freundesliste ab.",
    "- projectName muss bei create_task exakt einem Namen aus der Projektliste entsprechen (oder null, wenn nicht zutreffend); bei create_project ist projectName der NEUE Name, der darf auch noch nicht in der Liste stehen.",
    '- priority ist "medium", wenn nichts angegeben ist.',
    "- message ist bei create_task/create_project/add_tasks/send_message/add_friend/remove_friend eine kurze Bestätigung, bei clarify eine Rückfrage, bei chat eine normale Antwort, bei friend_status nur ein kurzer Platzhalter — jeweils max. 2 Sätze.",
  ].join("\n");
}

/** Sends the user's free-text request to the local Ollama model and parses the structured intent it returns. */
export async function extractTaskIntent(input: {
  prompt: string;
  projectNames: string[];
  friendNames: string[];
}): Promise<TaskIntent> {
  const parsed = await callOllamaJson([
    {
      role: "system",
      content: systemPrompt(input.projectNames, input.friendNames),
    },
    { role: "user", content: input.prompt },
  ]);

  const action =
    parsed.action === "create_task" ||
    parsed.action === "create_project" ||
    parsed.action === "add_tasks" ||
    parsed.action === "send_message" ||
    parsed.action === "add_friend" ||
    parsed.action === "remove_friend" ||
    parsed.action === "delete_project" ||
    parsed.action === "chat" ||
    parsed.action === "friend_status"
      ? parsed.action
      : "clarify";

  return {
    action,
    title: typeof parsed.title === "string" ? parsed.title : null,
    projectName:
      typeof parsed.projectName === "string" ? parsed.projectName : null,
    taskTitles: Array.isArray(parsed.taskTitles)
      ? parsed.taskTitles.filter(
          (item: unknown): item is string => typeof item === "string",
        )
      : null,
    dueDate: typeof parsed.dueDate === "string" ? parsed.dueDate : null,
    priority:
      parsed.priority === "low" || parsed.priority === "high"
        ? parsed.priority
        : "medium",
    friendName:
      typeof parsed.friendName === "string" ? parsed.friendName : null,
    messageBody:
      typeof parsed.messageBody === "string" ? parsed.messageBody : null,
    email: typeof parsed.email === "string" ? parsed.email : null,
    message:
      typeof parsed.message === "string"
        ? parsed.message
        : "Ich konnte die Anfrage nicht verarbeiten.",
  };
}

/** Parses a free-text reply about a due date (e.g. "in 2 Wochen", "kein Datum") into YYYY-MM-DD or null. */
export async function extractDueDateReply(
  prompt: string,
): Promise<string | null> {
  const parsed = await callOllamaJson([
    {
      role: "system",
      content: [
        `Heutiges Datum: ${todayIso()}.`,
        "Der Nutzer antwortet auf die Frage, bis wann etwas fertig sein soll.",
        'Antworte NUR mit JSON: {"dueDate": string|null (YYYY-MM-DD)}.',
        'Rechne relative Angaben ("in 2 Wochen", "morgen", "Ende des Monats") anhand des heutigen Datums um.',
        'Wenn der Nutzer kein Datum will ("kein Datum", "nein", "egal", "weiß nicht"), ist dueDate null.',
      ].join("\n"),
    },
    { role: "user", content: prompt },
  ]);
  return typeof parsed.dueDate === "string" ? parsed.dueDate : null;
}

/** Matches which of the user's friends were mentioned in a free-text reply (or none, if the user declined). */
export async function extractMentionedFriends(
  prompt: string,
  friendNames: string[],
): Promise<string[]> {
  if (friendNames.length === 0) return [];
  const parsed = await callOllamaJson([
    {
      role: "system",
      content: [
        `Freunde des Nutzers: ${friendNames.join(", ")}.`,
        "Der Nutzer antwortet auf die Frage, wer von seinen Freunden an einem Projekt teilnehmen soll.",
        'Antworte NUR mit JSON: {"names": string[]}.',
        "names enthält NUR Namen, die exakt aus der obigen Freundesliste stammen und vom Nutzer erkennbar gemeint sind.",
        'Wenn der Nutzer niemanden nennt oder ablehnt ("niemand", "nein", "nur ich"), ist names ein leeres Array.',
      ].join("\n"),
    },
    { role: "user", content: prompt },
  ]);
  const names = Array.isArray(parsed.names) ? parsed.names : [];
  return names.filter(
    (item: unknown): item is string => typeof item === "string",
  );
}

/** Maps each task title to a priority from a free-text reply — either one priority for all tasks, or per task. */
export async function extractTaskPriorities(
  prompt: string,
  taskTitles: string[],
): Promise<Record<string, Priority>> {
  const parsed = await callOllamaJson([
    {
      role: "system",
      content: [
        `Tasks: ${taskTitles.join(", ")}.`,
        "Der Nutzer antwortet auf die Frage, welche Priorität diese Tasks bekommen sollen.",
        'Antworte NUR mit JSON: {"priorities": { [taskTitel]: "low"|"medium"|"high" }} — mit EINEM Eintrag pro Task aus der obigen Liste, exakt mit diesem Titel als Schlüssel.',
        'Wenn der Nutzer eine einzelne Priorität für alle nennt (z. B. "mittel"), gilt sie für jeden Task.',
        'Wenn nichts erkennbar ist, nimm "medium".',
      ].join("\n"),
    },
    { role: "user", content: prompt },
  ]);

  const result: Record<string, Priority> = {};
  const priorities =
    parsed.priorities && typeof parsed.priorities === "object"
      ? parsed.priorities
      : {};
  for (const title of taskTitles) {
    const value = priorities[title];
    result[title] = value === "low" || value === "high" ? value : "medium";
  }
  return result;
}
