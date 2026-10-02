declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: (string | number | Uint8Array | null)[]): void;
    exec(sql: string, params?: (string | number | Uint8Array | null)[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: (string | number | null | Uint8Array)[][];
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
}
