"use client";

import React, { useState } from "react";

export interface DataPoint {
  day: string;
  fullDay: string;
  value: number;
  meetings: number;
  tasksCompleted: number;
  dateStr: string;
}

export const ACTIVITY_DATA: Record<"this_week" | "last_week", DataPoint[]> = {
  this_week: [
    { day: "Mon", fullDay: "Monday", value: 30, meetings: 1, tasksCompleted: 2, dateStr: "12 Aug" },
    { day: "Tue", fullDay: "Tuesday", value: 45, meetings: 2, tasksCompleted: 3, dateStr: "13 Aug" },
    { day: "Wed", fullDay: "Wednesday", value: 38, meetings: 1, tasksCompleted: 2, dateStr: "14 Aug" },
    { day: "Thu", fullDay: "Thursday", value: 60, meetings: 3, tasksCompleted: 4, dateStr: "15 Aug" },
    { day: "Fri", fullDay: "Friday", value: 72, meetings: 4, tasksCompleted: 5, dateStr: "16 Aug" },
    { day: "Sat", fullDay: "Saturday", value: 50, meetings: 1, tasksCompleted: 3, dateStr: "17 Aug" },
    { day: "Sun", fullDay: "Sunday", value: 65, meetings: 2, tasksCompleted: 4, dateStr: "18 Aug" },
  ],
  last_week: [
    { day: "Mon", fullDay: "Monday", value: 25, meetings: 1, tasksCompleted: 1, dateStr: "05 Aug" },
    { day: "Tue", fullDay: "Tuesday", value: 35, meetings: 1, tasksCompleted: 2, dateStr: "06 Aug" },
    { day: "Wed", fullDay: "Wednesday", value: 55, meetings: 3, tasksCompleted: 4, dateStr: "07 Aug" },
    { day: "Thu", fullDay: "Thursday", value: 48, meetings: 2, tasksCompleted: 3, dateStr: "08 Aug" },
    { day: "Fri", fullDay: "Friday", value: 64, meetings: 3, tasksCompleted: 4, dateStr: "09 Aug" },
    { day: "Sat", fullDay: "Saturday", value: 40, meetings: 0, tasksCompleted: 2, dateStr: "10 Aug" },
    { day: "Sun", fullDay: "Sunday", value: 52, meetings: 1, tasksCompleted: 3, dateStr: "11 Aug" },
  ],
};

interface ActivityChartProps {
  timeframe?: "this_week" | "last_week";
  onTimeframeChange?: (tf: "this_week" | "last_week") => void;
  selectedDay?: string | null;
  onSelectDay?: (day: string | null) => void;
  completedTasksBonus?: number;
  tasks?: any[];
  meetings?: any[];
}

export default function ActivityChart({
  timeframe = "this_week",
  onTimeframeChange,
  selectedDay = null,
  onSelectDay,
  completedTasksBonus = 0,
  tasks = [],
  meetings = [],
}: ActivityChartProps) {
  const [internalTimeframe, setInternalTimeframe] = useState<"this_week" | "last_week">(timeframe);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeTf = onTimeframeChange ? timeframe : internalTimeframe;
  const rawData = ACTIVITY_DATA[activeTf];

  // Dynamically compute activity counts from live tasks & meetings if available
  const data = rawData.map((d) => {
    const dayKey = d.day.toLowerCase();
    const dayTasks = tasks.filter((t: any) => {
      const dl = (t.deadline || "").toLowerCase();
      return dl.includes(dayKey) || dl.includes(d.fullDay.toLowerCase()) ||
        (dayKey === "mon" && dl.includes("today")) ||
        (dayKey === "tue" && dl.includes("tomorrow"));
    });
    const completedTasks = dayTasks.filter((t: any) => t.status === "completed").length;
    const dayMeetings = meetings.filter((m: any) => {
      const st = (m.scheduled_time || "").toLowerCase();
      return st.includes(dayKey) || (dayKey === "mon" && st.includes("today"));
    }).length;

    const dynamicValue = tasks.length > 0 || meetings.length > 0
      ? Math.min(85, Math.max(20, d.value + (completedTasks * 8) + (dayMeetings * 10) + (completedTasksBonus > 0 && d.day === "Fri" ? completedTasksBonus * 5 : 0)))
      : d.value;

    return {
      ...d,
      value: dynamicValue,
      meetings: dayMeetings > 0 ? dayMeetings : d.meetings,
      tasksCompleted: completedTasks > 0 ? completedTasks : (d.day === "Fri" ? d.tasksCompleted + completedTasksBonus : d.tasksCompleted),
    };
  });

  const height = 150;
  const width = 800;
  const paddingX = 45;
  const paddingY = 32;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const maxValue = 85;
  const minValue = 15;

  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * chartWidth;
    const y =
      height -
      paddingY -
      ((d.value - minValue) / (maxValue - minValue)) * chartHeight;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, point, index) => {
    return index === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
  }, "");

  const handlePointClick = (day: string) => {
    if (!onSelectDay) return;
    if (selectedDay === day) {
      onSelectDay(null); // Deselect
    } else {
      onSelectDay(day);
    }
  };

  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="w-full relative">
      {/* Top control bar: Timeframe switcher & Active Filter indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {selectedDay && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>
                Filtered by: <strong>{points.find((p) => p.day === selectedDay)?.fullDay}</strong> ({points.find((p) => p.day === selectedDay)?.value} pts)
              </span>
              <button
                onClick={() => onSelectDay?.(null)}
                className="ml-1 text-zinc-400 hover:text-white cursor-pointer"
                title="Clear day filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Timeframe pill toggle */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px]">
          <button
            onClick={() => {
              if (onTimeframeChange) onTimeframeChange("this_week");
              else setInternalTimeframe("this_week");
            }}
            className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTf === "this_week"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => {
              if (onTimeframeChange) onTimeframeChange("last_week");
              else setInternalTimeframe("last_week");
            }}
            className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTf === "last_week"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Last Week
          </button>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full h-44 overflow-visible">
        <svg
          viewBox={`0 0 ${width} ${height + 25}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Vertical guideline on hover */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={paddingY - 10}
              x2={hoveredPoint.x}
              y2={height + 10}
              stroke="#52525b"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          )}

          {/* Selected day indicator vertical line */}
          {selectedDay && (
            (() => {
              const sp = points.find((p) => p.day === selectedDay);
              if (!sp) return null;
              return (
                <line
                  x1={sp.x}
                  y1={paddingY - 10}
                  x2={sp.x}
                  y2={height + 10}
                  stroke="#ffffff"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
              );
            })()
          )}

          {/* Connecting line matching reference image */}
          <path
            d={pathD}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-90"
          />

          {/* Points & Labels above matching reference: 'Mon : 30', 'Tue : 45', etc. */}
          {points.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            const isSelected = selectedDay === p.day;

            return (
              <g
                key={idx}
                className="cursor-pointer transition-transform"
                onClick={() => handlePointClick(p.day)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Invisible large click & hover hit-box */}
                <circle cx={p.x} cy={p.y} r="22" fill="transparent" />

                {/* Selected pulsing outer ring */}
                {isSelected && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="9"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                  />
                )}

                {/* White circle node */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? 5 : isHovered ? 4.5 : 3}
                  fill="#ffffff"
                  className="transition-all duration-150"
                />

                {/* Text label above node (e.g. 'Mon : 30', 'Tue : 45') */}
                <text
                  x={p.x}
                  y={p.y - 10}
                  textAnchor="middle"
                  fill={isSelected ? "#ffffff" : isHovered ? "#ffffff" : "#d4d4d8"}
                  fontSize={isSelected || isHovered ? "10" : "9"}
                  fontWeight={isSelected || isHovered ? "bold" : "normal"}
                  fontFamily="inherit"
                  className="transition-all duration-150 select-none"
                >
                  {p.day} : {p.value}
                </text>

                {/* X-axis label below */}
                <text
                  x={p.x}
                  y={height + 18}
                  textAnchor="middle"
                  fill={isSelected ? "#ffffff" : isHovered ? "#ffffff" : "#a1a1aa"}
                  fontSize="10"
                  fontWeight={isSelected || isHovered ? "bold" : "normal"}
                  fontFamily="inherit"
                  className="transition-all duration-150 select-none"
                >
                  {p.day}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating rich tooltip on hover */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 shadow-xl text-left min-w-[160px]"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${Math.max(10, (hoveredPoint.y / (height + 25)) * 100 - 18)}%`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1 mb-1">
              <span className="text-[11px] font-bold text-white">{hoveredPoint.fullDay}</span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                {hoveredPoint.value} pts
              </span>
            </div>
            <div className="text-[10px] text-zinc-300 space-y-0.5">
              <p>• {hoveredPoint.meetings} Meetings processed</p>
              <p>• {hoveredPoint.tasksCompleted} Action items resolved</p>
            </div>
            <p className="text-[9px] text-zinc-500 pt-1 border-t border-zinc-800/60 mt-1">
              {selectedDay === hoveredPoint.day ? "Click to clear filter" : "Click to filter tasks by this day"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

