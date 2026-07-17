/**
 * Minimal database interface the app depends on. Both the real pg Pool and the
 * pg-mem test adapter satisfy it, so routes/repos are testable without a live DB.
 */
export interface Db {
  query<T = any>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}
