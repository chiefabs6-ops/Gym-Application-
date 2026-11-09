import { useRef, useState } from 'react';
import { Animated, PanResponder, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GripVertical } from 'lucide-react-native';
import { colors } from '../theme';

/**
 * Drag-to-reorder for a short list rendered with `map` inside a ScrollView (rows must stay mounted while
 * dragging, so not a FlatList). Rows sit back to back: each row reports its height, a row's top is the sum of
 * the heights above it, and the drop slot is where the dragged row's centre lands.
 */
export function useDragReorder(count: number, onReorder: (from: number, to: number) => void) {
  const heights = useRef<number[]>([]);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;

  const slotFor = (from: number, dy: number) => {
    let top = 0;
    const rows = heights.current.slice(0, count).map((h) => {
      const at = { y: top, h: h ?? 0 };
      top += at.h;
      return at;
    });
    const own = rows[from];
    if (!own) return from;
    const centre = own.y + own.h / 2 + dy;
    let to = from;
    rows.forEach((r, i) => {
      if (i < from && centre < r.y + r.h / 2) to = Math.min(to, i);
      if (i > from && centre > r.y + r.h / 2) to = Math.max(to, i);
    });
    return to;
  };

  const handlers = (from: number) => ({
    onStart: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      dragY.setValue(0);
      setDrag({ from, to: from });
    },
    onMove: (dy: number) => {
      dragY.setValue(dy);
      const to = slotFor(from, dy);
      setDrag((d) => {
        if (d && d.to !== to) void Haptics.selectionAsync();
        return d && d.to === to ? d : { from, to };
      });
    },
    onEnd: (dy: number) => {
      const to = slotFor(from, dy);
      setDrag(null);
      dragY.setValue(0);
      if (to !== from) onReorder(from, to);
    },
  });

  /** Style for row `index`: the dragged row follows the finger; rows between it and the drop slot make room. */
  const rowStyle = (index: number): Animated.WithAnimatedValue<ViewStyle> => {
    if (drag?.from === index) return { zIndex: 10, elevation: 10, transform: [{ translateY: dragY }, { scale: 1.02 }] };
    let shift = 0;
    if (drag) {
      const h = heights.current[drag.from] ?? 0;
      if (drag.to > drag.from && index > drag.from && index <= drag.to) shift = -h;
      if (drag.to < drag.from && index >= drag.to && index < drag.from) shift = h;
    }
    return { transform: [{ translateY: shift }] };
  };

  const measure = (index: number) => (e: LayoutChangeEvent) => {
    heights.current[index] = e.nativeEvent.layout.height;
  };

  return { drag, dragging: drag !== null, handlers, rowStyle, measure };
}

/**
 * Grip that drags its row: press and move. It claims the gesture from the list's scroll and keeps it, and reports
 * the vertical travel. Callbacks are read through a ref so they stay current.
 */
export function DragHandle({
  label,
  active,
  onStart,
  onMove,
  onEnd,
}: {
  label: string;
  active: boolean;
  onStart: () => void;
  onMove: (dy: number) => void;
  onEnd: (dy: number) => void;
}) {
  const latest = useRef({ onStart, onMove, onEnd });
  latest.current = { onStart, onMove, onEnd };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onStart(),
      onPanResponderMove: (_, g) => latest.current.onMove(g.dy),
      onPanResponderRelease: (_, g) => latest.current.onEnd(g.dy),
      onPanResponderTerminate: (_, g) => latest.current.onEnd(g.dy),
    }),
  ).current;
  return (
    <View {...responder.panHandlers} hitSlop={8} className="h-9 w-6 items-center justify-center" accessibilityLabel={label}>
      <GripVertical size={18} color={active ? colors.ink : colors.subtle} />
    </View>
  );
}
