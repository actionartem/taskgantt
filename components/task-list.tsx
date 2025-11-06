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
    <Card className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Список задач</h2>
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

      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedTasks).map(([groupName, groupTasksList]) => (
          <div key={groupName}>
            {groupBy !== "none" && (
              <div className="sticky top-0 bg-muted px-4 py-2 text-sm font-medium border-b">{groupName}</div>
            )}
            {groupTasksList.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Задачи не найдены</div>
            ) : (
              groupTasksList.map((task) => <TaskItem key={task.id} task={task} onEdit={onEditTask} />)
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// На будущее: если где-то подключат как default — тоже будет работать.
export default TaskList
