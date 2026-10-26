import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Alert.alert on iOS/Android. React Native Web's Alert is a no-op, so on web a
 * single action becomes window.confirm and several become a numbered prompt —
 * keeping every confirmation working in the browser preview too.
 */
export function ask(title: string, message: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') { Alert.alert(title, message, buttons); return; }
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  if (actions.length === 0) { window.alert(`${title}\n\n${message}`); return; }
  if (actions.length === 1) {
    if (window.confirm(`${title}\n\n${message}`)) actions[0].onPress?.();
    return;
  }
  const answer = window.prompt(`${title}\n\n${message}\n\n${actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}\n\nType a number:`, '1');
  const pick = actions[Number(answer) - 1];
  pick?.onPress?.();
}
