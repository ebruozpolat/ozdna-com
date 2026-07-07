import { eq, and, desc } from "drizzle-orm";
import type { VerticalMode } from "@ozdna/core";
import { getDb, prompts } from "@ozdna/db";

export interface ResolvedPrompt {
  id: string;
  name: string;
  version: number;
  content: string;
  hash: string;
}

export function getPrompt(
  workflow: "detect",
  mode: VerticalMode,
  variables: Record<string, string> = {},
): ResolvedPrompt {
  const db = getDb();

  const rows = db
    .select()
    .from(prompts)
    .where(
      and(
        eq(prompts.workflow, workflow),
        eq(prompts.mode, mode),
        eq(prompts.active, true),
      ),
    )
    .orderBy(desc(prompts.version))
    .limit(1)
    .all();

  let row = rows[0];

  if (!row && mode !== "general") {
    const fallback = db
      .select()
      .from(prompts)
      .where(
        and(
          eq(prompts.workflow, workflow),
          eq(prompts.mode, "general"),
          eq(prompts.active, true),
        ),
      )
      .orderBy(desc(prompts.version))
      .limit(1)
      .all();
    row = fallback[0];
  }

  const template =
    row?.content ??
    `Execute ${workflow} workflow for mode ${mode}. Language: {{language}}.`;

  let content = template;
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return {
    id: row?.id ?? "default",
    name: row?.name ?? `${workflow}-${mode}-default`,
    version: row?.version ?? 0,
    content,
    hash: row?.hash ?? "default",
  };
}

export function listPrompts() {
  const db = getDb();
  return db.select().from(prompts).where(eq(prompts.active, true)).all();
}
