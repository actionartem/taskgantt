"use client";
import { memo, useLayoutEffect, useState, type RefObject } from "react";
import type { buildGanttCalendar } from "@/lib/gantt-calendar";

type Calendar = ReturnType<typeof buildGanttCalendar>;
export const GanttCalendarHeader = memo(function GanttCalendarHeader({ calendar, width, scroll }: { calendar: Calendar; width: number; scroll: RefObject<HTMLDivElement | null> }) {
  const [windowRange, setWindowRange] = useState({ left: 0, right: 1800 });
  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const left = Math.max(0, Math.floor(el.scrollLeft / 180) * 180 - 180), right = left + el.clientWidth + 540;
      setWindowRange(prev => prev.left === left && prev.right === right ? prev : { left, right });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    el.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    return () => { el.removeEventListener("scroll", schedule); observer.disconnect(); cancelAnimationFrame(frame); };
  }, [scroll, calendar]);
  return <div className="timeline-head" style={{ width }}>
    <div className="calendar-months">{calendar.months.map(m => <span key={m.label} style={{ left: m.left, width: m.width }}><b className="calendar-month-label">{m.label}</b></span>)}</div>
    <div className="calendar-ticks">{calendar.ticks.filter(t => t.left + t.width >= windowRange.left && t.left <= windowRange.right).map(t => <span key={t.left} className={`${t.today ? "is-today" : ""} ${t.off ? "is-day-off" : ""}`} title={t.title} style={{ left: t.left, width: t.width }}>{t.label}<small>{t.today ? "сег" : t.sub}</small></span>)}</div>
  </div>;
});
