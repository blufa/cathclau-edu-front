"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Indicator, Popover, ScrollArea } from "@mantine/core";
import { Bell, CheckCheck } from "lucide-react";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/inbox";
import { NOTIFICATION_TYPE_LABEL, type Notification } from "@/lib/types/notification";
import { formatDateTime } from "@/lib/format";

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
    <Popover position="bottom-end" shadow="md" radius="lg" width={340} withArrow opened={opened} onChange={setOpened}>
      <Popover.Target>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setOpened((o) => !o)}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-700"
        >
          <Indicator color="brand" size={8} disabled={unread === 0} offset={4}>
            <Bell className="h-[18px] w-[18px]" />
          </Indicator>
        </button>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
            </button>
          )}
        </div>
        <ScrollArea.Autosize mah={320}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Bell className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-slate-700">Aucune notification</p>
              <p className="text-xs text-slate-400">Vous êtes à jour.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`block w-full px-4 py-3 text-left transition hover:bg-slate-50 ${n.read ? "" : "bg-brand-50/40"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}
                      </span>
                    </div>
                    {n.content && <p className="text-xs text-slate-500">{n.content}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
