import { prisma } from "./db";
import { decryptSecret } from "./crypto";
import { createTask, type TodoistTask } from "./todoist";

type EntryType = "TASK" | "JOURNAL" | "THOUGHT" | "CONTEXT" | "KNOWLEDGE";
type TaskWhen = "TODAY" | "THIS_WEEK" | "SOMEDAY";

/**
 * Push úkolu do Todoistu (capture → moje úkoly).
 * Vrací Todoist task ID + project ID, nebo throw.
 *
 * TaskWhen se mapuje na due_string:
 *   TODAY      → "today"
 *   THIS_WEEK  → "this week" (Todoist si naplánuje na pátek/víkend dle locale)
 *   SOMEDAY    → žádný due
 */
export async function pushEntryToTodoist(params: {
  userId: string;
  text: string;
  type: EntryType;
  when?: TaskWhen | null;
  suggestedProject?: string | null;
  rationale?: string | null;
  knowledgeUrl?: string | null;
  knowledgeCategory?: string | null;
  hashtags?: string[];
}): Promise<{ taskId: string; projectId: string }> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId: params.userId, provider: "todoist" } },
  });
  if (!integration) {
    throw new Error("Todoist integrace není nakonfigurovaná. Nastavení → Todoist (Firewall).");
  }

  const token = decryptSecret({
    enc: integration.tokenEnc,
    iv: integration.tokenIv,
    tag: integration.tokenTag,
  });

  const cfg = (integration.config ?? {}) as {
    vyruseni?: string;
    vip?: string;
    mojeUkoly?: string;
  };
  // Pro TASK/capture použijeme config.mojeUkoly, jinak inbox (undefined).
  const projectId = cfg.mojeUkoly || undefined;

  const due =
    params.when === "TODAY"
      ? "today"
      : params.when === "THIS_WEEK"
        ? "this week"
        : undefined;

  const labels = ["capture"];
  if (params.type === "KNOWLEDGE") labels.push("knowledge");
  if (params.suggestedProject) labels.push(params.suggestedProject.toLowerCase().replace(/\s+/g, "-").slice(0, 30));
  for (const h of params.hashtags ?? []) {
    const tag = h.replace(/^#/, "").toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    if (tag && !labels.includes(tag)) labels.push(tag);
  }

  const descriptionLines: string[] = [];
  if (params.rationale) descriptionLines.push(params.rationale);
  if (params.knowledgeUrl) descriptionLines.push(`\n${params.knowledgeUrl}`);
  if (params.knowledgeCategory) descriptionLines.push(`\n_${params.knowledgeCategory}_`);

  const task: TodoistTask = await createTask(token, {
    content: params.text.slice(0, 500),
    description: descriptionLines.join("\n").slice(0, 16000) || undefined,
    project_id: projectId,
    priority: 1,
    due_string: due,
    labels,
  });

  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: { lastUsedAt: new Date(), lastError: null },
  });

  return { taskId: task.id, projectId: task.project_id };
}
