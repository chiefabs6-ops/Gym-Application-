import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { addDaysToKey } from '@gym/shared';
import { colors } from '../../theme';

const HEIGHT = 150;
const PAD = 6;
/** Right-hand lane for the value labels. */
const LANE = 28;

type Point = { local_date: string; value: number };

/**
 * Weigh-ins as grey dots, the 30-day average as a green line and, when there's a goal, the goal pace as a
 * dashed line. Days are spaced by date (a gap of a week looks like a week), oldest left, today at the right.
 */
export function WeightTrendChart({
  points,
  trend,
  goal,
  fromKey,
  todayKey,
  toDisplay,
}: {
  points: Point[];
  trend: Point[];
  goal: [Point, Point] | null;
  fromKey: string;
  todayKey: string;
  /** kg → the user's unit, for the value labels. */
  toDisplay: (kg: number) => number;
}) {
  const [width, setWidth] = useState(0);
  const shown = points.filter((p) => p.local_date >= fromKey);
  if (shown.length < 2) {
    return <Text className="py-6 text-center text-sm text-ink-muted">Log at least two weigh-ins to see your trend.</Text>;
  }
  const line = trend.filter((p) => p.local_date >= fromKey);
  const all = [...shown, ...line, ...(goal ?? [])].map((p) => toDisplay(p.value));
  const lo = Math.floor(Math.min(...all) - 0.3);
  const hi = Math.ceil(Math.max(...all) + 0.3);
  const span = Math.max(1, hi - lo);
  const every = Math.max(1, Math.ceil(span / 4));
  const ticks = Array.from({ length: Math.floor(span / every) + 1 }, (_, i) => lo + i * every).filter((t) => t > lo && t <= hi);

  const days = Math.max(1, dayIndex(fromKey, todayKey));
  const plotW = width - LANE;
  const x = (key: string) => PAD + (dayIndex(fromKey, key) / days) * (plotW - PAD * 2);
  const y = (kg: number) => PAD + (1 - (toDisplay(kg) - lo) / span) * (HEIGHT - PAD * 2);
  const yTick = (v: number) => PAD + (1 - (v - lo) / span) * (HEIGHT - PAD * 2);
  const end = line[line.length - 1];

  return (
    <View className="gap-1.5">
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {ticks.map((t) => (
              <Line key={t} x1={PAD} x2={plotW} y1={yTick(t)} y2={yTick(t)} stroke={colors.border} strokeDasharray="3 4" />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={width - 2} y={yTick(t) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
                {String(t)}
              </SvgText>
            ))}
            {shown.map((p, i) => (
              <Circle key={i} cx={x(p.local_date)} cy={y(p.value)} r={2.5} fill="#6E6E78" />
            ))}
            {goal && (
              <Line
                x1={x(goal[0].local_date)}
                x2={x(goal[1].local_date)}
                y1={y(goal[0].value)}
                y2={y(goal[1].value)}
                stroke={colors.muted}
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            )}
            {line.length > 1 && (
              <Polyline
                points={line.map((p) => `${x(p.local_date)},${y(p.value)}`).join(' ')}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            )}
            {end && <Circle cx={x(end.local_date)} cy={y(end.value)} r={4} fill={colors.accent} />}
          </Svg>
        )}
      </View>
      <View className="flex-row justify-between" style={{ paddingRight: LANE }}>
        <Text className="text-[11px] text-ink-muted">{dayMonth(fromKey)}</Text>
        <Text className="text-[11px] text-ink-muted">{dayMonth(addDaysToKey(fromKey, Math.round(days / 2)))}</Text>
        <Text className="text-[11px] text-ink-muted">Today</Text>
      </View>
    </View>
  );
}

function dayIndex(fromKey: string, key: string): number {
  const t = (k: string) => {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(key) - t(fromKey)) / 86_400_000);
}

const dayMonth = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
