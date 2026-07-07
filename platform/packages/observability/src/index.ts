import { generateId } from "@ozdna/core";
import { getDb, auditLogs } from "@ozdna/db";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  requestId: string;
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export function log(entry: Omit<LogEntry, "timestamp">): void {
  const full: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  const line = JSON.stringify(full);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

export function audit(
  requestId: string,
  orgId: string,
  apiKeyId: string,
  action: string,
  resource: string,
  metadata?: Record<string, unknown>,
): void {
  const db = getDb();
  db.insert(auditLogs)
    .values({
      id: generateId("aud"),
      requestId,
      orgId,
      apiKeyId,
      action,
      resource,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date(),
    })
    .run();

  log({
    level: "info",
    requestId,
    component: "audit",
    message: `${action} ${resource}`,
    metadata,
  });
}

export function traceSpan(
  requestId: string,
  component: string,
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>,
): void {
  log({
    level: "debug",
    requestId,
    component,
    message: `${operation} completed in ${durationMs}ms`,
    metadata,
  });
}
