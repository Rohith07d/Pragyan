"use client";

interface DataPoint {
  day: string;
  value: number;
}

const defaultData: DataPoint[] = [
  { day: "Mon", value: 30 },
  { day: "Tue", value: 45 },
  { day: "Wed", value: 38 },
  { day: "Thu", value: 60 },
  { day: "Fri", value: 72 },
  { day: "Sat", value: 50 },
  { day: "Sun", value: 65 },
];

export default function ActivityChart() {
  const data = defaultData;
  const height = 150;
  const width = 800;
  const paddingX = 40;
  const paddingY = 30;

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

  return (
    <div className="w-full">
      <div className="relative w-full h-44 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height + 25}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
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
          {points.map((p, idx) => (
            <g key={idx}>
              {/* White circle node */}
              <circle cx={p.x} cy={p.y} r="3" fill="#ffffff" />
              {/* Text label above node */}
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fill="#d4d4d8"
                fontSize="9"
                fontFamily="inherit"
              >
                {p.day} : {p.value}
              </text>
              {/* X-axis label below */}
              <text
                x={p.x}
                y={height + 15}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize="10"
                fontFamily="inherit"
              >
                {p.day}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
