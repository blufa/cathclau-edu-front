"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/inbox";
import { NOTIFICATION_TYPE_LABEL, type Notification } from "@/lib/types/notification";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

/**
 * Header notifications bell, wired to the in-app inbox (`GET /api/v1/notifications`). Polls the
 * unread count every minute; loads the full list when the popover opens. Clicking a notification
 * marks it read and follows its `link` when present.
 */
export function NotificationsMenu() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [opened, setOpened] = useState(false);

  // Poll the unread count (the bell must never block the UI, so failures stay silent).
  useEffect(() => {
    const tick = () => getUnreadCount().then(({ count }) => setUnread(count)).catch(() => {});
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Load the full list whenever the popover opens.
  useEffect(() => {
    if (!opened) return;
    listNotifications()
      .then((list) => {
        setItems(list);
        setUnread(list.filter((n) => !n.read).length);
      })
      .catch(() => {});
  }, [opened]);

  async function handleClick(n: Notification) {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        /* silencieux */
      }
    }
    if (n.link) {
      setOpened(false);
      router.push(n.link);
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
      setUnread(0);
    } catch {
      /* silencieux */
    }
  }

  return (
    <Dropdown
      open={opened}
      onOpenChange={setOpened}
      panelClassName="w-[340px] p-0"
      trigger={({ toggle }) => (
        <button
          type="button"
          aria-label="Notifications"
          onClick={toggle}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-brand-300 hover:text-brand-700"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" />
          )}
        </button>
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">Notifications</span>
        {unread > 0 && (
          <button
            onClick={handleMarkAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Bell className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-gray-700">Aucune notification</p>
            <p className="text-xs text-gray-400">Vous êtes à jour.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn("block w-full px-4 py-3 text-left transition hover:bg-gray-50", !n.read && "bg-brand-50/40")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      {NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}
                    </span>
                  </div>
                  {n.content && <p className="text-xs text-gray-500">{n.content}</p>}
                  <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dropdown>
  );
}
