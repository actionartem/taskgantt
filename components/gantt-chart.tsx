"use client"

import type React from "react"

import { useMemo, useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Task } from "@/lib/types"
import { STATUS_COLORS } from "@/lib/types"
import { useApp } from "@/contexts/app-context"
import { groupTasks } from "@/lib/task-utils"

interface GanttChartProps {
  onEditTask: (task: Task) => void
}

export function GanttChart({ onEditTask }: GanttChartProps) {
  const { tasks, updateTask, groupBy, selectedStatuses } = useApp()
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragType, setDragType] = useState<"move" | "resize-left" | "resize-right" | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null)
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
  const visibleTasks = tasks.filter(
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
      <div className="p-4 border-b flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Диаграмма Ганта</h2>
        <Button variant="outline" size="sm" onClick={handleScrollToToday}>
          Сегодня
        </Button>
      </div>

      <div className="border-b">
        <div ref={topScrollRef} className="h-4 overflow-x-auto">
          <div style={{ width: `${chartWidth}px`, height: "1px" }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={mainScrollRef}>
        <div className="relative min-w-max">
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500/90 pointer-events-none z-20"
            style={{ left: `${getPositionFromDate(today) + 200}px` }}
          />
          {/* Временная шкала */}
          <div className="sticky top-0 z-10 bg-card border-b">
            <div className="flex flex-col" style={{ paddingLeft: "200px" }}>
              <div className="flex h-10 text-[11px] text-muted-foreground">
                {timelineDays.map((date, index) => {
                  const isWeekStart = date.getDay() === 1
                  const isHoliday = isNonWorkingDay(date)

                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-center border-l first:border-l-0 ${
                        isWeekStart ? "font-medium" : ""
                      } ${isHoliday ? "bg-red-500/10" : ""}`}
                      style={{ width: `${dayWidth}px` }}
                      title={date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                    >
                      {date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
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
                    <div key={task.id} className="flex items-center border-b h-12 hover:bg-muted/50">
                      <div className="w-[200px] px-4 text-sm truncate flex-shrink-0">{task.title}</div>
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
                          className="absolute top-1/2 -translate-y-1/2 rounded cursor-move group z-10"
                          style={{
                            left: `${startPos}px`,
                            width: `${width}px`,
                            height: "28px",
                            backgroundColor: STATUS_COLORS[task.status],
                          }}
                          onMouseDown={(e) => handleMouseDown(task, "move", e)}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditTask(task)
                          }}
                        >
                          {/* Левый край для изменения размера */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              handleMouseDown(task, "resize-left", e)
                            }}
                            onClick={(e) => e.stopPropagation()}
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
                            onClick={(e) => e.stopPropagation()}
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
