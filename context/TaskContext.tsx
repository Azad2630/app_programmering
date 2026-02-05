import React, { createContext, useContext } from 'react';

import type { TaskCtx } from './taskContextTypes';
import { useTaskManager } from './useTaskManager';

const Ctx = createContext<TaskCtx | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const value = useTaskManager();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTasks() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTasks skal bruges inde i <TaskProvider>');
  return ctx;
}
