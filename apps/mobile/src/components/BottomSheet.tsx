import { useEffect, useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra classes for the sheet panel (padding, max height…). */
  className?: string;
  animationType?: 'slide' | 'fade';
  /** false = tapping the backdrop / Back does nothing (e.g. while saving). */
  dismissable?: boolean;
  onShow?: () => void;
  /** Lift the sheet above the on-screen keyboard (for sheets with text inputs). */
  avoidKeyboard?: boolean;
}

/**
 * Keyboard height while it's open. KeyboardAvoidingView doesn't move content inside a Modal with
 * Android edge-to-edge, so sheets pad themselves by this amount instead.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Shared bottom sheet. The dim backdrop is a separate layer BEHIND the panel (not a parent of it),
 * so the panel's content is never inside a touchable: scroll views inside a sheet scroll from
 * anywhere, and taps on the panel never close it. (Nesting the panel in Pressables made Android
 * hand drags to the Pressable instead of the ScrollView.)
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  className = '',
  animationType = 'slide',
  dismissable = true,
  onShow,
  avoidKeyboard = false,
}: Props) {
  const keyboardHeight = useKeyboardHeight();
  const bottomInset = avoidKeyboard ? keyboardHeight : 0;
  const close = () => {
    if (dismissable) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={close} onShow={onShow}>
      <View style={[styles.root, { paddingBottom: bottomInset }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          className="bg-black/60"
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View className={`rounded-t-3xl border-t border-surface-border bg-surface-raised ${className}`}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'flex-end' } });
