"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type React from "react";
import type { Task, AppSettings, GroupBy, TaskStatus } from "@/lib/types";
import { storage } from "@/lib/storage";
import {
  fetchTasks,
  createTaskNew,
  updateTaskNew,
  deleteTaskNew,
  getUsers,
  getBoardTags,
} from "@/lib/api";
interface AppContextType {
  tasks: Task[];
  settings: AppSettings;
  groupBy: GroupBy;
  selectedStatuses: TaskStatus[];
  lastRefresh: string | null;
  refreshError: string | null;
  loading: boolean;
  setTasks: (tasks: Task[]) => void;
  clearTasksState: () => void;
  addTask: (task: Task) => Promise<void>;
  updateTask: (id: number, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  setSettings: (settings: React.SetStateAction<AppSettings>) => void;
  refreshFromApi: () => Promise<void>;
  setGroupBy: (group: GroupBy) => void;
  toggleSelectedStatus: (status: TaskStatus) => void;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
function owner() {
  try {
    return String(
      JSON.parse(localStorage.getItem("st_user") || "null")?.id || "",
    );
  } catch {
    return "";
  }
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]),
    [settings, setSettings] = useState<AppSettings>({
      executors: [],
      tags: [],
    });
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null),
    [refreshError, setRefreshError] = useState<string | null>(null),
    [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const lastAutoRefresh = useRef(0);
  const refreshFromApi = useCallback(async () => {
    const user = owner();
    if (!user) return;
    const seq = ++sequence.current;
    setLoading(true);
    try {
      const [users, tags, data] = await Promise.all([
        getUsers(),
        getBoardTags(1),
        fetchTasks(),
      ]);
      if (seq !== sequence.current || user !== owner()) return;
      setTasks(prev => JSON.stringify(prev) === JSON.stringify(data) ? prev : data);
      const nextSettings = {
        executors: users.map((u) => ({
          id: Number(u.id),
          name: u.name,
          role: u.role_text,
        })),
        tags: tags.map((t) => t.title),
      };
      setSettings(prev => JSON.stringify(prev) === JSON.stringify(nextSettings) ? prev : nextSettings);
      setLastRefresh(new Date().toISOString());
      setRefreshError(null);
    } catch (e) {
      if (seq === sequence.current)
        setRefreshError(
          e instanceof Error ? e.message : "Не удалось обновить данные",
        );
      throw e;
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    storage.saveTheme("light");
    document.documentElement.classList.remove("dark");
    const refresh = () => {
      if (document.visibilityState === "visible" && owner() && Date.now() - lastAutoRefresh.current > 10000) {
        lastAutoRefresh.current = Date.now();
        void refreshFromApi().catch(() => {});
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 120000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshFromApi]);
  const clearTasksState = useCallback(() => {
    sequence.current++;
    setTasks([]);
    setSettings({ executors: [], tags: [] });
    setLoading(false);
    setLastRefresh(null);
    setRefreshError(null);
  }, []);
  const mergeSaved = (saved: Task) => {
    sequence.current++;
    setTasks((prev) =>
      prev.some((t) => t.id === saved.id)
        ? prev.map((t) =>
            t.id === saved.id ? saved : t,
          )
        : [...prev, saved],
    );
    setLoading(false);
  };
  const addTask = async (task: Task) => {
    const user = owner();
    const saved = await createTaskNew(task);
    if (user !== owner()) return;
    mergeSaved(saved);
    void refreshFromApi().catch(() => {});
  };
  const updateTask = async (id: number, updates: Partial<Task>) => {
    const user = owner();
    const patch = { ...updates };
    delete patch.hiddenFromGantt;
    delete patch.assigneeName;
    delete patch.statusLog;
    delete patch.id;
    if (!Object.keys(patch).length) return;
    const saved = await updateTaskNew(id, patch);
    if (user !== owner()) return;
    mergeSaved(saved);
    void refreshFromApi().catch(() => {});
  };
  const deleteTask = async (id: number) => {
    const user = owner();
    await deleteTaskNew(id);
    if (user !== owner()) return;
    sequence.current++;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };
  return (
    <AppContext.Provider
      value={{
        tasks,
        settings,
        groupBy,
        selectedStatuses,
        lastRefresh,
        refreshError,
        loading,
        setTasks,
        clearTasksState,
        addTask,
        updateTask,
        deleteTask,
        setSettings,
        refreshFromApi,
        setGroupBy,
        toggleSelectedStatus: (status) =>
          setSelectedStatuses((prev) =>
            prev.includes(status)
              ? prev.filter((s) => s !== status)
              : [...prev, status],
          ),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
