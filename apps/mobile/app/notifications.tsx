import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { Muted, Loading, ErrorRow, EmptyState, Separator } from '../src/components/ui';
import { useAdapter, useDataEpoch } from '../src/data/AdapterProvider';
import { useAsync, humanError } from '../src/hooks/useAsync';
import { useToast } from '../src/components/ToastProvider';
import { colors, radius, space, font } from '../src/theme';
import { timeAgo } from '@shared/lib/time';

export default function Notifications() {
  const adapter = useAdapter();
  const router = useRouter();
  const toast = useToast();
  const epoch = useDataEpoch();
  const notifs = useAsync(() => adapter.listNotifications(), [epoch]);
  const items = notifs.data ?? [];
  const unread = items.filter((n) => !n.readAt);

  async function markRead(id: string) {
    try { await adapter.markNotificationRead(id); notifs.reload(); } catch (e) { toast(humanError(e), 'error'); }
  }
  async function markAll() {
    try { await Promise.all(unread.map((n) => adapter.markNotificationRead(n.id))); notifs.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={18} color={colors.forest600} /><Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.title}>Notifications</Text>
        {unread.length > 0 && <Pressable onPress={markAll}><Text style={styles.markAll}>Mark all read</Text></Pressable>}
      </View>
      <Muted style={{ fontSize: font.tiny }}>In-app only — ToGo does not send real SMS, email, or push messages in this pilot.</Muted>

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
              <Pressable onPress={() => !n.readAt && markRead(n.id)} accessibilityRole="button" style={({ pressed }) => [styles.item, n.readAt && { opacity: 0.7 }, pressed && { backgroundColor: colors.forest50 }]}>
                <View style={[styles.dot, { backgroundColor: n.readAt ? colors.border : colors.forest700 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{n.title}</Text>
                  <Text style={styles.itemBody}>{n.body}</Text>
                  <Text style={styles.itemTime}>{timeAgo(n.createdAt)}{n.readAt ? ' · read' : ''}</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      )}
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
