import { useMemo, useState } from 'react';
import type { CheckMark } from '../lib/healthScoring';

interface HealthGraphProps {
  checks: CheckMark[];
  windowHours: number;
}

const GRAPH_HEIGHT = 72;
const DOT_RADIUS = 5;
const AXIS_HEIGHT = 18;


export default function HealthGraph({ checks, windowHours }: HealthGraphProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // CheckMark timestamps already have the server clock offset applied (log_ts + 1h),
  // so plain Date.now() is the correct reference point here.
  const now = useMemo(() => Date.now(), []);
  const windowMs = windowHours * 60 * 60_000;
  const startMs = now - windowMs;

  // Only show checks within the window
  const visibleChecks = useMemo(
    () => checks.filter((c) => c.timestamp.getTime() >= startMs),
    [checks, startMs],
  );

  const axisLabels = useMemo(() => {
    const labels: { label: string; pct: number }[] = [];
    // Dots are placed with xPct = 1 - age/window, so:
    //   left (pct=0) = oldest (windowHours ago)
    //   right (pct=1) = newest (now)
    // Labels mirror this: left shows the oldest age, right shows "now".
    const steps = windowHours >= 48 ? 4 : windowHours >= 24 ? 4 : 3;
    for (let i = 0; i <= steps; i++) {
      // ageHours decreases left→right: leftmost = windowHours, rightmost = 0
      const ageHours = windowHours - (windowHours / steps) * i;
      const pct = i / steps;
      let label: string;
      if (ageHours === 0) {
        label = 'now';
      } else if (ageHours < 24) {
        label = `${Math.round(ageHours)}h`;
      } else {
        label = `${Math.round(ageHours / 24)}d`;
      }
      labels.push({ label, pct });
    }
    return labels;
  }, [windowHours]);

  const formatTooltip = (check: CheckMark): string => {
    const d = check.timestamp;
    const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const status = check.success ? 'Success' : 'Failure';
    const reason = check.reason ? `\n${check.reason}` : '';
    return `${status} · ${dateStr}${reason}`;
  };

  if (visibleChecks.length === 0) {
    return (
      <div style={{ padding: '1rem 0', color: '#666', fontSize: '0.85rem', textAlign: 'center' }}>
        No checks in the last {windowHours}h
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        width="100%"
        viewBox={`0 0 1000 ${GRAPH_HEIGHT + AXIS_HEIGHT}`}
        preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Background track */}
        <line
          x1={0}
          y1={GRAPH_HEIGHT / 2}
          x2={1000}
          y2={GRAPH_HEIGHT / 2}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {/* Axis tick lines */}
        {axisLabels.map(({ pct }) => (
          <line
            key={pct}
            x1={pct * 1000}
            y1={GRAPH_HEIGHT - 4}
            x2={pct * 1000}
            y2={GRAPH_HEIGHT + 4}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
          />
        ))}

        {/* Axis labels */}
        {axisLabels.map(({ label, pct }) => (
          <text
            key={pct}
            x={pct * 1000}
            y={GRAPH_HEIGHT + AXIS_HEIGHT - 2}
            textAnchor={pct === 0 ? 'start' : pct === 1 ? 'end' : 'middle'}
            fontSize={14}
            fill="rgba(255,255,255,0.35)"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {label}
          </text>
        ))}

        {/* Check dots */}
        {visibleChecks.map((check, i) => {
          const ageMs = now - check.timestamp.getTime();
          const xPct = 1 - ageMs / windowMs; // 0=left/oldest, 1=right/newest
          const x = Math.max(DOT_RADIUS, Math.min(1000 - DOT_RADIUS, xPct * 1000));
          const y = GRAPH_HEIGHT / 2;
          const color = check.success ? 'rgba(0,255,159,0.85)' : 'rgba(255,85,99,0.85)';
          const glowColor = check.success ? 'rgba(0,255,159,0.3)' : 'rgba(255,85,99,0.3)';

          return (
            <g
              key={i}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const svg = (e.currentTarget as SVGGElement).closest('svg')!;
                const rect = svg.getBoundingClientRect();
                const svgX = ((x / 1000) * rect.width) + rect.left;
                const svgY = rect.top + (y / (GRAPH_HEIGHT + AXIS_HEIGHT)) * rect.height;
                setTooltip({ x: svgX, y: svgY, content: formatTooltip(check) });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Glow halo */}
              <circle cx={x} cy={y} r={DOT_RADIUS + 3} fill={glowColor} />
              {/* Main dot */}
              <circle cx={x} cy={y} r={DOT_RADIUS} fill={color} />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            background: 'rgba(18,18,28,0.97)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
            color: '#ddd',
            whiteSpace: 'pre-line',
            pointerEvents: 'none',
            zIndex: 9999,
            maxWidth: '260px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
