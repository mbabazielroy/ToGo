import { Alert, Platform, type AlertButton } from 'react-native';

export interface DialogRequest { title: string; message: string; buttons: AlertButton[] }
type Listener = (r: DialogRequest) => void;
let listener: Listener | null = null;

/** Used by DialogHost (web only) to show requests as an in-app dialog. */
export function setDialogListener(fn: Listener): () => void {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

/**
 * A confirmation or choice: the system alert on iOS and Android. React Native
 * Web's Alert does nothing, and browsers' prompt() is blocked in some places, so
 * on web DialogHost shows the same title, message and buttons in the page.
 */
export function ask(title: string, message: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') { Alert.alert(title, message, buttons); return; }
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  if (listener) { listener({ title, message, buttons: list }); return; }
  // Before the host has mounted (very early in start-up): plain browser dialogs.
  const actions = list.filter((b) => b.style !== 'cancel');
  if (actions.length <= 1) {
    if (window.confirm(`${title}\n\n${message}`)) actions[0]?.onPress?.();
  } else {
    window.alert(`${title}\n\n${message}`);
  }
}
