import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors } from '../../theme';

const HEIGHT = 120;
const PAD = 8;

/** Weigh-ins as dots and the 30-day average as a line (spec §8.1), oldest left. */
export function WeightTrendChart({
  points,
  trend,
  format,
}: {
  points: { local_date: string; value: number }[];
  trend: { local_date: string; value: number }[];
  format: (kg: number) => string;
}) {
  const [width, setWidth] = useState(0);
  if (points.length < 2) {
    return <Text className="py-6 text-center text-sm text-ink-subtle">Log at least two weigh-ins to see your trend.</Text>;
  }
  const dates = [...new Set([...points, ...trend].map((p) => p.local_date))].sort();
  const values = [...points, ...trend].map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.5, max - min);
  const x = (d: string) => PAD + (dates.indexOf(d) / Math.max(1, dates.length - 1)) * (width - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (HEIGHT - PAD * 2);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {points.map((p, i) => (
            <Circle key={i} cx={x(p.local_date)} cy={y(p.value)} r={2.5} fill={colors.faint} />
          ))}
          <Polyline points={trend.map((p) => `${x(p.local_date)},${y(p.value)}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={2.5} />
        </Svg>
      )}
      <View className="flex-row justify-between">
        <Text className="text-[11px] text-ink-subtle">{format(min)}</Text>
        <Text className="text-[11px] text-ink-subtle">30-day average</Text>
        <Text className="text-[11px] text-ink-subtle">{format(max)}</Text>
      </View>
    </View>
  );
}
