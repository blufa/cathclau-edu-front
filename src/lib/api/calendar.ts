import { api } from "@/lib/api/client";
import type { AcademicEvent, AcademicEventInput } from "@/lib/types/calendar";

export function listEvents(academicYearId?: number): Promise<AcademicEvent[]> {
  return api.get<AcademicEvent[]>("/calendar/events", { query: { academicYearId } });
}

export function createEvent(input: AcademicEventInput): Promise<AcademicEvent> {
  return api.post<AcademicEvent>("/calendar/events", input);
}

export function updateEvent(id: number, input: AcademicEventInput): Promise<AcademicEvent> {
  return api.put<AcademicEvent>(`/calendar/events/${id}`, input);
}

export function deleteEvent(id: number): Promise<void> {
  return api.delete<void>(`/calendar/events/${id}`);
}
