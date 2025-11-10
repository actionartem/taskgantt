"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import type { Task } from "@/lib/types"
import { STATUS_COLORS } from "@/lib/types"
import { useApp } from "@/contexts/app-context"
import { groupTasks } from "@/lib/task-utils"

export function GanttChart() {
  const { tasks, updateTask, groupBy, hiddenStatuses } = useApp()
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragType, setDragType] = useState<"move" | "resize-left" | "resize-right" | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScrollRef = useRef(false)

  // Фильтруем задачи с датами и не скрытые
  const visibleTasks = tasks.filter(
    (task) =>
      task.startDate &&
      task.endDate &&
      !task.hiddenFromGantt &&
      !hiddenStatuses.includes(task.status),
  )

  // Группируем задачи
  const groupedTasks = groupTasks(visibleTasks, groupBy)

  // Вычисляем диапазон дат
  const getDateRange = () => {
    if (visibleTasks.length === 0) {
      const today = new Date()
      const nextMonth = new Date(today)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      return { minDate: today, maxDate: nextMonth }
    }

    const dates = visibleTasks.flatMap((task) => [new Date(task.startDate!), new Date(task.endDate!)])
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    // Добавляем отступы
    minDate.setDate(minDate.getDate() - 7)
    maxDate.setDate(maxDate.getDate() + 7)

    return { minDate, maxDate }
  }

  const { minDate, maxDate } = getDateRange()
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
  const dayWidth = 40 // пикселей на день
  const chartWidth = (totalDays + 1) * dayWidth + 200

  const getPositionFromDate = (date: Date) => {
    const days = Math.ceil((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
    return days * dayWidth
  }

  const getDateFromPosition = (x: number) => {
    const days = Math.floor(x / dayWidth)
    const date = new Date(minDate)
    date.setDate(date.getDate() + days)
    return date
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0]
  }

  const handleMouseDown = (task: Task, type: "move" | "resize-left" | "resize-right", e: React.MouseEvent) => {
    e.preventDefault()
    setDraggedTask(task)
    setDragType(type)
    setDragStartX(e.clientX)
    setDragStartDate(new Date(task.startDate!))
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggedTask || !dragType || !dragStartDate) return

      const deltaX = e.clientX - dragStartX
      const deltaDays = Math.round(deltaX / dayWidth)

      if (deltaDays === 0) return

      const startDate = new Date(draggedTask.startDate!)
      const endDate = new Date(draggedTask.endDate!)

      if (dragType === "move") {
        startDate.setDate(startDate.getDate() + deltaDays)
        endDate.setDate(endDate.getDate() + deltaDays)
        updateTask(draggedTask.id, {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        })
      } else if (dragType === "resize-left") {
        startDate.setDate(startDate.getDate() + deltaDays)
        if (startDate < endDate) {
          updateTask(draggedTask.id, { startDate: formatDate(startDate) })
        }
      } else if (dragType === "resize-right") {
        endDate.setDate(endDate.getDate() + deltaDays)
        if (endDate > startDate) {
          updateTask(draggedTask.id, { endDate: formatDate(endDate) })
        }
      }

      setDragStartX(e.clientX)
    }

    const handleMouseUp = () => {
      setDraggedTask(null)
      setDragType(null)
      setDragStartX(0)
      setDragStartDate(null)
    }

    if (draggedTask) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [draggedTask, dragType, dragStartX, dragStartDate, dayWidth, updateTask])

  // Генерация временной шкалы
  const generateTimeline = () => {
    const timeline = []
    const currentDate = new Date(minDate)

    while (currentDate <= maxDate) {
      timeline.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 7) // по неделям
    }

    return timeline
  }

  const timeline = generateTimeline()

  useEffect(() => {
    const topScroll = topScrollRef.current
    const mainScroll = mainScrollRef.current

    if (!topScroll || !mainScroll) {
      return
    }

    const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isSyncingScrollRef.current) {
        return
      }

      isSyncingScrollRef.current = true
      target.scrollLeft = source.scrollLeft
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false
      })
    }

    const handleTopScroll = () => {
      if (topScroll && mainScroll) {
        syncScroll(topScroll, mainScroll)
      }
    }

    const handleMainScroll = () => {
      if (topScroll && mainScroll) {
        syncScroll(mainScroll, topScroll)
      }
    }

    topScroll.addEventListener("scroll", handleTopScroll)
    mainScroll.addEventListener("scroll", handleMainScroll)

    return () => {
      topScroll.removeEventListener("scroll", handleTopScroll)
      mainScroll.removeEventListener("scroll", handleMainScroll)
    }
  }, [])

  if (visibleTasks.length === 0) {
    return (
      <Card className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Диаграмма Ганта</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Нет задач с датами для отображения
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Диаграмма Ганта</h2>
      </div>

      <div className="border-b">
        <div ref={topScrollRef} className="h-4 overflow-x-auto">
          <div style={{ width: `${chartWidth}px`, height: "1px" }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={mainScrollRef}>
        <div className="min-w-max">
          {/* Временная шкала */}
          <div className="sticky top-0 z-10 bg-card border-b">
            <div className="flex h-12 items-center" style={{ paddingLeft: "200px" }}>
              {timeline.map((date, index) => {
                const friday = new Date(date)
                friday.setDate(friday.getDate() + 4)

                return (
                  <div
                    key={index}
                    className="relative h-full"
                    style={{ width: `${dayWidth * 7}px` }}
                  >
                    <span
                      className="absolute text-xs text-muted-foreground whitespace-nowrap pointer-events-none"
                      style={{ top: "50%", left: 0, transform: "translateY(-50%)" }}
                    >
                      {date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </span>
                    <span
                      className="absolute text-xs text-muted-foreground whitespace-nowrap pointer-events-none"
                      style={{
                        top: "50%",
                        left: `${dayWidth * 4}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      {friday.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Задачи */}
          <div className="relative">
            {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
              <div key={groupName}>
                {groupBy !== "none" && (
                  <div className="sticky left-0 bg-muted px-4 py-2 text-sm font-medium border-b">{groupName}</div>
                )}
                {groupTasks.map((task, taskIndex) => {
                  const startPos = getPositionFromDate(new Date(task.startDate!))
                  const endPos = getPositionFromDate(new Date(task.endDate!))
                  const width = endPos - startPos

                  return (
                    <div key={task.id} className="flex items-center border-b h-12 hover:bg-muted/50">
                      <div className="w-[200px] px-4 text-sm truncate flex-shrink-0">{task.title}</div>
                      <div className="flex-1 relative" style={{ height: "48px" }}>
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded cursor-move group"
                          style={{
                            left: `${startPos}px`,
                            width: `${width}px`,
                            height: "28px",
                            backgroundColor: STATUS_COLORS[task.status],
                          }}
                          onMouseDown={(e) => handleMouseDown(task, "move", e)}
                        >
                          {/* Левый край для изменения размера */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              handleMouseDown(task, "resize-left", e)
                            }}
                          />

                          {/* Текст задачи */}
                          <div className="px-2 text-xs text-white truncate leading-7">{task.title}</div>

                          {/* Правый край для изменения размера */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              handleMouseDown(task, "resize-right", e)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
