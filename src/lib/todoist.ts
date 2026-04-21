/**
 * Todoist REST API v2 klient.
 * Dokumentace: https://developer.todoist.com/rest/v2/
 *
 * Používáme:
 *  - GET /projects — list pro picker v settings
 *  - POST /tasks — vytvoření úkolu z call-log
 *  - GET /projects/{id} — test připojení (+ sanity check)
 */

const BASE = "https://api.todoist.com/rest/v2";

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  parent_id?: string | null;
  is_inbox_project?: boolean;
}

export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  project_id: string;
  priority: 1 | 2 | 3 | 4; // 1 = lowest, 4 = highest (urgent)
  url: string;
}

export interface CreateTaskInput {
  content: string;
  description?: string;
  project_id?: string;
  priority?: 1 | 2 | 3 | 4;
  due_string?: string; // "today", "tomorrow at 9am", ...
  labels?: string[];
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Todoist ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listProjects(token: string): Promise<TodoistProject[]> {
  return call<TodoistProject[]>(token, "/projects");
}

export async function createTask(token: string, input: CreateTaskInput): Promise<TodoistTask> {
  return call<TodoistTask>(token, "/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function testConnection(token: string): Promise<{ ok: true; projectCount: number } | { ok: false; error: string }> {
  try {
    const projects = await listProjects(token);
    return { ok: true, projectCount: projects.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
