import { useAdapter } from '../../../data/AdapterProvider';
import { useToast } from '../../../components/ToastProvider';
import { useAsync, humanError } from '../hooks';
import { Loading, ErrorRow } from '../parts';
import { EmptyState } from '../../../components/ui';
import { Bell, CheckCheck } from 'lucide-react';
import { timeAgo } from '../../../lib/time';

export function NotificationsPage() {
  const adapter = useAdapter();
  const toast = useToast();
  const notifs = useAsync(() => adapter.listNotifications(), []);
  const items = notifs.data ?? [];
  const unread = items.filter((n) => !n.readAt);

  async function markRead(id: string) {
    try { await adapter.markNotificationRead(id); notifs.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
  }
  async function markAll() {
    try { await Promise.all(unread.map((n) => adapter.markNotificationRead(n.id))); notifs.reload(); }
    catch (e) { toast(humanError(e), 'error'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-forest-900">Notifications</h1>
        {unread.length > 0 && (
          <button onClick={markAll} className="flex items-center gap-1.5 text-sm font-semibold text-forest-600"><CheckCheck size={16} /> Mark all read</button>
        )}
      </div>
      <p className="text-xs text-forest-400">In-app only — ToGo does not send real SMS, email, or push messages in this pilot.</p>
      {notifs.loading && <Loading />}
      {notifs.error && <ErrorRow message={notifs.error} onRetry={notifs.reload} />}
      {items.length === 0 && !notifs.loading && <EmptyState icon={<Bell size={32} />} title="No notifications yet">Booking confirmations, schedule changes, delays and cancellations appear here.</EmptyState>}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id}>
            <button onClick={() => !n.readAt && markRead(n.id)}
              className={`card flex w-full items-start gap-3 p-3.5 text-left ${n.readAt ? 'opacity-70' : ''}`}>
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-forest-200' : 'bg-lime-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-forest-900">{n.title}</div>
                <div className="text-sm text-forest-600">{n.body}</div>
                <div className="mt-0.5 text-[11px] text-forest-400">{timeAgo(n.createdAt)}{n.readAt ? ' · read' : ''}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
