/**
 * sql.js.d.ts
 *
 * Hand-written ambient types for the subset of sql.js the bot uses.
 *
 * The published package ships no usable typings for this surface, so only the
 * members actually called are declared here. Note the API is synchronous and
 * `exec` returns column/value arrays rather than row objects — repositories
 * (see repositories/Database.ts) map that shape into plain objects.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

declare module 'sql.js' {
  export interface Database {
    /** Executes a statement, including writes. */
    run(sql: string, params?: (string | number | Uint8Array | null)[]): void;
    /** Executes a query and returns one result set per statement. */
    exec(sql: string, params?: (string | number | Uint8Array | null)[]): QueryExecResult[];
    /** Serialises the whole in-memory database to bytes. */
    export(): Uint8Array;
    close(): void;
  }

  export interface QueryExecResult {
    /** Column names, in select order. */
    columns: string[];
    /** One array of values per row. */
    values: (string | number | null | Uint8Array)[][];
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
}
