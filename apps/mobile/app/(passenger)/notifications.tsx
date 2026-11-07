import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Muted, Loading, ErrorRow, EmptyState, Separator, PrimaryButton } from '@/components/ui';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync, humanError } from '@/hooks/useAsync';
import { useToast } from '@/components/ToastProvider';
import { colors, radius, space, font } from '@/theme';
import { timeAgo } from '@shared/lib/time';
import type { NotificationView } from '@shared/data/adapter';
import { useSession } from '@/session/SessionProvider';
import { visibleAlerts } from '@/lib/alerts';

export default function Notifications() {
  const adapter = useAdapter();
  const router = useRouter();
  const toast = useToast();
  const mode = useAppMode();
  const { session } = useAuth();
  const epoch = useDataEpoch();
  const signedOut = mode === 'connected' && !session;
  const notifs = useAsync(() => (signedOut ? Promise.resolve([]) : adapter.listNotifications()), [epoch, signedOut]);
  const { profile } = useSession();
  const items = visibleAlerts(notifs.data ?? [], profile);
  const unread = items.filter((n) => !n.readAt);

  async function markRead(id: string) {
    try { await adapter.markNotificationRead(id); notifs.reload(); } catch (e) { toast(humanError(e), 'error'); }
  }
  // Tapping a notification marks it read and, when it references a booking, opens it.
  function open(n: NotificationView) {
    if (!n.readAt) markRead(n.id);
    if (n.bookingId) router.push(`/trip/${n.bookingId}`);
  }
  async function markAll() {
    try { await Promise.all(unread.map((n) => adapter.markNotificationRead(n.id))); notifs.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={colors.forest600} /><Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.title}>Notifications</Text>
        {unread.length > 0 && <Pressable onPress={markAll} accessibilityRole="button" hitSlop={8}><Text style={styles.markAll}>Mark all read</Text></Pressable>}
      </View>
      <Muted style={{ fontSize: font.tiny }}>Alerts about your trips appear here and on Home while the app is open.</Muted>

      {signedOut ? (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <EmptyState title="Sign in to see notifications">Booking confirmations, delays and cancellations appear here once you sign in.</EmptyState>
          <PrimaryButton title="Sign in" onPress={() => router.push('/auth?next=/notifications')} />
        </View>
      ) : (<>
      {notifs.loading && <Loading />}
      {notifs.error && <ErrorRow message={notifs.error} onRetry={notifs.reload} />}
      {!notifs.loading && items.length === 0 && (
        <EmptyState title="No notifications yet">Booking confirmations, schedule changes, delays and cancellations appear here.</EmptyState>
      )}
      {items.length > 0 && (
        <View style={styles.list}>
          {items.map((n, i) => (
            <View key={n.id}>
              {i > 0 && <Separator inset={30} />}
              <Pressable onPress={() => open(n)} accessibilityRole="button" style={({ pressed }) => [styles.item, n.readAt && { opacity: 0.7 }, pressed && { backgroundColor: colors.forest50 }]}>
                <View style={[styles.dot, { backgroundColor: n.readAt ? colors.border : colors.forest700 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{n.title}</Text>
                  <Text style={styles.itemBody}>{n.body}</Text>
                  <Text style={styles.itemTime}>{timeAgo(n.createdAt)}{n.readAt ? ' · read' : ''}</Text>
                </View>
                {n.bookingId ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
              </Pressable>
            </View>
          ))}
        </View>
      )}
      </>)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: colors.forest600, fontWeight: '700', fontSize: font.small },
  title: { fontSize: font.h1, fontWeight: '700', color: colors.ink },
  markAll: { color: colors.forest700, fontWeight: '500', fontSize: font.small },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.md, overflow: 'hidden' },
  item: { flexDirection: 'row', gap: 10, paddingVertical: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  itemTitle: { fontWeight: '600', color: colors.ink, fontSize: font.body },
  itemBody: { color: colors.inkSoft, fontSize: font.small, marginTop: 1 },
  itemTime: { color: colors.muted, fontSize: font.tiny, marginTop: 2 },
});
