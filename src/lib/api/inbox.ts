import { api } from "@/lib/api/client";
import type { Notification } from "@/lib/types/notification";

/** Cloche de notifications in-app (§13) : chaque utilisateur voit ses propres notifications. */
export function listNotifications(): Promise<Notification[]> {
  return api.get<Notification[]>("/notifications");
}

export function getUnreadCount(): Promise<{ count: number }> {
  return api.get<{ count: number }>("/notifications/unread-count");
}

export function markNotificationRead(id: number): Promise<void> {
  return api.patch<void>(`/notifications/${id}/lu`);
}

export function markAllNotificationsRead(): Promise<void> {
  return api.patch<void>("/notifications/lues");
}
