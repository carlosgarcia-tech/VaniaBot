declare global {
  var db: {
    data: {
      users: Record<string, unknown>;
      chats: Record<string, unknown>;
    };
  };
}

export {};
