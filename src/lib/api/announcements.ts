import { api } from "@/lib/api/client";
import type {
  Announcement,
  AnnouncementInput,
  AnnouncementUpdate,
} from "@/lib/types/announcement";

export function listAnnouncements(): Promise<Announcement[]> {
  return api.get<Announcement[]>("/announcements");
}

export function getAnnouncement(id: number): Promise<Announcement> {
  return api.get<Announcement>(`/announcements/${id}`);
}

export function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  return api.post<Announcement>("/announcements", input);
}

export function updateAnnouncement(id: number, input: AnnouncementUpdate): Promise<Announcement> {
  return api.put<Announcement>(`/announcements/${id}`, input);
}

export function deleteAnnouncement(id: number): Promise<void> {
  return api.delete<void>(`/announcements/${id}`);
}
