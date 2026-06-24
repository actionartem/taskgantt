"use client"

import type React from "react"

import { memo, useMemo, useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Task } from "@/lib/types"
import { STATUS_COLORS } from "@/lib/types"
import { useApp } from "@/contexts/app-context"
import { groupTasks } from "@/lib/task-utils"

interface GanttChartProps {
  canEdit?: boolean
  onEditTask: (task: Task) => void
}

type DragPreview = { id: number; startDate: string; endDate: string }

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("ru-RU", { day: "2-digit" })
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")
}

function GanttChartComponent({ canEdit = true, onEditTask }: GanttChartProps) {
  const { tasks, updateTask, groupBy, selectedStatuses } = useApp()
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragType, setDragType] = useState<"move" | "resize-left" | "resize-right" | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null)
  const [dragStartEndDate, setDragStartEndDate] = useState<Date | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const dragPreviewRef = useRef<DragPreview | null>(null)
  const lastDragDeltaRef = useRef(0)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScrollRef = useRef(false)
  const didAutoScrollRef = useRef(false)
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  // Фильтруем задачи с датами и не скрытые
  const hasStatusFilter = selectedStatuses.length > 0
  const visibleTasks = tasks
    .map((task) =>
      dragPreview && task.id === dragPreview.id
        ? { ...task, startDate: dragPreview.startDate, endDate: dragPreview.endDate }
        : task,
    )
    .filter(
      (task) =>
        task.startDate &&
        task.endDate &&
        !task.hiddenFromGantt &&
        (!hasStatusFilter || selectedStatuses.includes(task.status)),
    )

  // Группируем задачи
  const groupedTasks = groupTasks(visibleTasks, groupBy)

  // Вычисляем диапазон дат
  const getDateRange = () => {
    if (visibleTasks.length === 0) {
      const nextMonth = new Date(today)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      return { minDate: today, maxDate: nextMonth }
    }

    const dates = visibleTasks.flatMap((task) => [new Date(task.startDate!), new Date(task.endDate!)])
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    if (today < minDate) {
      minDate.setTime(today.getTime())
    }

    if (today > maxDate) {
      maxDate.setTime(today.getTime())
    }

    // Добавляем отступы
    minDate.setDate(minDate.getDate() - 7)
    maxDate.setDate(maxDate.getDate() + 7)

    return { minDate, maxDate }
  }

  const { minDate, maxDate } = getDateRange()
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
  const dayWidth = 40 // пикселей на день
  const chartWidth = (totalDays + 1) * dayWidth + 200

  const gridBackground = useMemo(() => {
    const dayStep = `${dayWidth}px`
    const weekStep = `${dayWidth * 7}px`

    return `repeating-linear-gradient(to right, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 1px, transparent 1px, transparent ${dayStep}), repeating-linear-gradient(to right, rgba(59,130,246,0.15) 0, rgba(59,130,246,0.15) 2px, transparent 2px, transparent ${weekStep})`
  }, [dayWidth])

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

  const handleScrollToToday = () => {
    const mainScroll = mainScrollRef.current
    const topScroll = topScrollRef.current

    if (!mainScroll || !topScroll) {
      return
    }

    const todayPosition = getPositionFromDate(today) + 200
    const targetScrollLeft = Math.max(0, todayPosition - mainScroll.clientWidth / 2)

    mainScroll.scrollLeft = targetScrollLeft
    topScroll.scrollLeft = targetScrollLeft
  }

  useEffect(() => {
    if (didAutoScrollRef.current) {
      return
    }

    if (!mainScrollRef.current || !topScrollRef.current) {
      return
    }

    didAutoScrollRef.current = true
    requestAnimationFrame(() => {
      handleScrollToToday()
    })
  }, [maxDate, minDate, visibleTasks.length])

  const handleMouseDown = (task: Task, type: "move" | "resize-left" | "resize-right", e: React.MouseEvent) => {
    if (!canEdit) return
    e.preventDefault()
    setDraggedTask(task)
    setDragType(type)
    setDragStartX(e.clientX)
    setDragStartDate(new Date(task.startDate!))
    setDragStartEndDate(new Date(task.endDate!))
    setDragPreview(null)
    dragPreviewRef.current = null
    lastDragDeltaRef.current = 0
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggedTask || !dragType || !dragStartDate || !dragStartEndDate) return

      const deltaX = e.clientX - dragStartX
      const deltaDays = Math.round(deltaX / dayWidth)

      if (deltaDays === lastDragDeltaRef.current) return

      const startDate = new Date(dragStartDate)
      const endDate = new Date(dragStartEndDate)

      if (dragType === "move") {
        startDate.setDate(startDate.getDate() + deltaDays)
        endDate.setDate(endDate.getDate() + deltaDays)
        const nextPreview = {
          id: draggedTask.id,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        }
        setDragPreview(nextPreview)
        dragPreviewRef.current = nextPreview
      } else if (dragType === "resize-left") {
        startDate.setDate(startDate.getDate() + deltaDays)
        if (startDate < endDate) {
          const nextPreview = {
            id: draggedTask.id,
            startDate: formatDate(startDate),
            endDate: draggedTask.endDate!,
          }
          setDragPreview(nextPreview)
          dragPreviewRef.current = nextPreview
        }
      } else if (dragType === "resize-right") {
        endDate.setDate(endDate.getDate() + deltaDays)
        if (endDate > startDate) {
          const nextPreview = {
            id: draggedTask.id,
            startDate: draggedTask.startDate!,
            endDate: formatDate(endDate),
          }
          setDragPreview(nextPreview)
          dragPreviewRef.current = nextPreview
        }
      }

      lastDragDeltaRef.current = deltaDays
    }

    const handleMouseUp = () => {
      const preview = dragPreviewRef.current
      if (draggedTask && preview) {
        updateTask(draggedTask.id, {
          startDate: preview.startDate,
          endDate: preview.endDate,
        })
      }
      setDraggedTask(null)
      setDragType(null)
      setDragStartX(0)
      setDragStartDate(null)
      setDragStartEndDate(null)
      setDragPreview(null)
      dragPreviewRef.current = null
      lastDragDeltaRef.current = 0
    }

    if (draggedTask) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [canEdit, draggedTask, dragType, dragStartX, dragStartDate, dragStartEndDate, dayWidth, updateTask])

  const timelineDays = useMemo(() => {
    return Array.from({ length: totalDays + 1 }, (_, index) => {
      const date = new Date(minDate)
      date.setDate(date.getDate() + index)
      return date
    })
  }, [minDate, totalDays])

  const holidays = useMemo(() => {
    const fixedHolidays = [
      "1-1",
      "1-2",
      "1-3",
      "1-4",
      "1-5",
      "1-6",
      "1-7",
      "1-8",
      "2-23",
      "3-8",
      "5-1",
      "5-9",
      "6-12",
      "11-4",
    ]

    return new Set(fixedHolidays)
  }, [])

  const isNonWorkingDay = (date: Date) => {
    const day = date.getDay()
    const isWeekend = day === 0 || day === 6
    const key = `${date.getMonth() + 1}-${date.getDate()}`
    return isWeekend || holidays.has(key)
  }

  const syncHorizontalScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
    if (isSyncingScrollRef.current) {
      return
    }

    isSyncingScrollRef.current = true
    target.scrollLeft = source.scrollLeft
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false
    })
  }

  const handleTopScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const mainScroll = mainScrollRef.current
    if (!mainScroll) return
    syncHorizontalScroll(event.currentTarget, mainScroll)
  }

  const handleMainScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const topScroll = topScrollRef.current
    if (!topScroll) return
    syncHorizontalScroll(event.currentTarget, topScroll)
  }

  if (visibleTasks.length === 0) {
    return (
      <Card className="flex h-full flex-col gap-0 py-0">
        <div className="flex min-h-10 items-center border-b bg-gradient-to-r from-primary/10 via-card to-accent/35 px-3 py-1">
          <h2 className="text-sm font-semibold">Диаграмма Ганта</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Нет задач с датами для отображения
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden py-0">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-card to-accent/35 px-3 py-1">
        <h2 className="text-sm font-semibold">Диаграмма Ганта</h2>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleScrollToToday}>
          Сегодня
        </Button>
      </div>

      <div className="border-b">
        <div
          ref={topScrollRef}
          className="h-3 overflow-x-auto overflow-y-hidden [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2"
          onScroll={handleTopScroll}
        >
          <div style={{ width: `${chartWidth}px`, height: "1px" }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={mainScrollRef} onScroll={handleMainScroll}>
        <div className="relative min-w-max">
          <div
            className="absolute bottom-0 top-9 z-20 w-px bg-red-500/90 pointer-events-none"
            style={{ left: `${getPositionFromDate(today) + 200}px` }}
          />
          {/* Временная шкала */}
          <div className="sticky top-0 z-40 border-b bg-card/95 shadow-sm">
            <div className="flex flex-col" style={{ paddingLeft: "200px" }}>
              <div className="flex h-9 text-muted-foreground">
                {timelineDays.map((date, index) => {
                  const isWeekStart = date.getDay() === 1
                  const isHoliday = isNonWorkingDay(date)

                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center justify-center border-l text-center leading-none first:border-l-0 ${
                        isWeekStart ? "text-blue-600 dark:text-blue-300" : ""
                      } ${isHoliday ? "bg-red-500/10" : ""}`}
                      style={{ width: `${dayWidth}px` }}
                      title={date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                    >
                      <span className="text-xs font-semibold tabular-nums text-foreground">{formatDayLabel(date)}</span>
                      <span className="mt-0.5 text-[9px] font-medium uppercase">{formatMonthLabel(date)}</span>
                    </div>
                  )
                })}
              </div>
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
                  const width = endPos - startPos + dayWidth

                  return (
                    <div key={task.id} className="interactive-row flex h-12 items-center border-b hover:bg-accent/30">
                      <div className="w-[200px] flex-shrink-0 truncate px-4 text-sm font-medium">{task.title}</div>
                      <div
                        className="flex-1 relative"
                        style={{
                          height: "48px",
                          backgroundImage: gridBackground,
                        }}
                      >
                        <div className="absolute inset-0 flex pointer-events-none">
                          {timelineDays.map((date, index) => (
                            <div
                              key={`${task.id}-day-${index}`}
                              className={isNonWorkingDay(date) ? "bg-red-500/10" : ""}
                              style={{ width: `${dayWidth}px` }}
                            />
                          ))}
                        </div>
                        <div
                          className={`group absolute top-1/2 z-10 -translate-y-1/2 rounded-md shadow-sm transition-shadow duration-150 hover:shadow-md ${
                            canEdit ? "cursor-move" : "cursor-default"
                          }`}
                          style={{
                            left: `${startPos}px`,
                            width: `${width}px`,
                            height: "28px",
                            backgroundColor: STATUS_COLORS[task.status],
                          }}
                          onMouseDown={(e) => handleMouseDown(task, "move", e)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (canEdit) onEditTask(task)
                          }}
                        >
                          {/* Левый край для изменения размера */}
                          {canEdit ? (
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                handleMouseDown(task, "resize-left", e)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}

                          {/* Текст задачи */}
                          <div className="px-2 text-xs text-white truncate leading-7">{task.title}</div>

                          {/* Правый край для изменения размера */}
                          {canEdit ? (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                handleMouseDown(task, "resize-right", e)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}
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

export const GanttChart = memo(GanttChartComponent)
