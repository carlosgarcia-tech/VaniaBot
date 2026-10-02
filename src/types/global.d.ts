/**
 * Global type declarations for VaniaBot.
 * Provides TypeScript types for global variables.
 */
declare global {
  var db: {
    data: {
      users: Record<string, unknown>;
      chats: Record<string, unknown>;
    };
  };
}

export {};