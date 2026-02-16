"use client"

import React, { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TaskFilters } from "./task-filters"
import { TaskItem } from "./task-item"
import type { Task, TaskPriority, TaskStatus } from "@/lib/types"
import { useApp } from "@/contexts/app-context"
import { filterTasks, groupTasks } from "@/lib/task-utils"

interface TaskListProps {
  onCreateTask: () => void
  onEditTask: (task: Task) => void
}

export const TaskList: React.FC<TaskListProps> = ({ onCreateTask, onEditTask }) => {
  const { tasks, groupBy } = useApp()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<TaskStatus | "Все">("Все")
  // селект «Исполнитель» теперь возвращает id (или "Все")
  const [assigneeId, setAssigneeId] = useState<string>("Все")
  const [tag, setTag] = useState("Все")
  const [priority, setPriority] = useState<TaskPriority | "Все">("Все")

  // 1) Фильтрация по исполнителю по id
  const tasksByAssignee = useMemo(() => {
    if (assigneeId === "Все") return tasks
    return tasks.filter((t) => String(t.assigneeId ?? "") === String(assigneeId))
  }, [tasks, assigneeId])

  // 2) Остальные фильтры — как раньше (именным фильтром по assignee больше не пользуемся)
  const filteredTasks = filterTasks(tasksByAssignee, {
    search,
    status,
    assignee: undefined, // имя больше не используется
    tag: tag === "Все" ? undefined : tag,
    priority,
  })

  const groupedTasks = groupTasks(filteredTasks, groupBy)

  return (
    <Card className="relative flex h-full flex-col overflow-hidden border-white/50 bg-card/85 shadow-xl dark:border-white/10">
      <div className="flex items-center justify-between border-b border-white/30 bg-linear-to-r from-primary/5 via-transparent to-cyan-400/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold tracking-tight">Список задач</h2>
        <Button onClick={onCreateTask} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Создать задачу
        </Button>
      </div>

      <TaskFilters
        search={search}
        status={status}
        assigneeId={assigneeId}
        tag={tag}
        priority={priority}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onAssigneeChange={setAssigneeId}
        onTagChange={setTag}
        onPriorityChange={setPriority}
      />

      <div className="fancy-scrollbar relative flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 bg-[url('/images/clown.jpeg')] bg-[length:100%_auto] bg-top bg-no-repeat opacity-5" />
        <div className="relative z-10">
          {Object.entries(groupedTasks).map(([groupName, groupTasksList]) => (
            <div key={groupName}>
              {groupBy !== "none" && (
                <div className="sticky top-0 border-b border-white/40 bg-muted/85 px-4 py-2 text-sm font-medium backdrop-blur-xs dark:border-white/10">{groupName}</div>
              )}
              {groupTasksList.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Задачи не найдены</div>
              ) : (
                groupTasksList.map((task) => <TaskItem key={task.id} task={task} onEdit={onEditTask} />)
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// На будущее: если где-то подключат как default — тоже будет работать.
export default TaskList
