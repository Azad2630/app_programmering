export type LocalTask = {
  localId: string;
  remoteId?: number;
  title: string;
  is_completed: boolean;
  updated_at: string; // ISO
  synced: boolean;
  deleted?: boolean;
};

export type RemoteTaskRow = {
  id: number;
  title: string;
  is_completed: boolean;
  updated_at: string;
};
