"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { TaskList } from "@/components/task-list"
import { TaskForm } from "@/components/task-form"
import { GanttChart } from "@/components/gantt-chart"
import { Settings } from "@/components/settings"
import type { Task } from "@/lib/types"

export default function HomePage() {
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)

  const handleCreateTask = () => {
    setEditingTask(undefined)
    setShowTaskForm(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setShowTaskForm(true)
  }

  const handleCloseTaskForm = () => {
    setShowTaskForm(false)
    setEditingTask(undefined)
  }

  return (
    <div className="flex flex-col h-screen">
      <Header onOpenSettings={() => setShowSettings(true)} />

      <main className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-2 gap-4 p-4">
          <TaskList onCreateTask={handleCreateTask} onEditTask={handleEditTask} />
          <GanttChart />
        </div>
      </main>

      <TaskForm task={editingTask} open={showTaskForm} onClose={handleCloseTaskForm} />
      <Settings open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
