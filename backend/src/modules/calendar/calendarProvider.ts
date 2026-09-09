// CAL-01..07 — same adapter seam as StorageAdapter/SmsProvider/PushProvider,
// except Wave 1 ships the real implementation here (not a stub): the
// product owner chose Google-only, no Outlook/ICS fallback (Sprint 3 HLD
// §3), so there's exactly one provider to write either way. Kept behind
// this interface anyway for testability and in case a second provider is
// ever added.
export interface CalendarEventInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmails: string[];
}

export interface CalendarProvider {
  createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEventInput,
  ): Promise<{ eventId: string }>;
  updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: CalendarEventInput,
  ): Promise<void>;
  cancelEvent(accessToken: string, calendarId: string, eventId: string): Promise<void>;
}

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

function toGoogleEventBody(event: CalendarEventInput) {
  return {
    summary: event.title,
    description: event.description,
    start: { dateTime: event.startTime.toISOString() },
    end: { dateTime: event.endTime.toISOString() },
    attendees: event.attendeeEmails.map((email) => ({ email })),
  };
}

class GoogleCalendarProvider implements CalendarProvider {
  async createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEventInput,
  ): Promise<{ eventId: string }> {
    const res = await fetch(eventsUrl(calendarId), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(toGoogleEventBody(event)),
    });
    if (!res.ok) {
      throw new Error(`Google Calendar createEvent failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string };
    return { eventId: data.id };
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: CalendarEventInput,
  ): Promise<void> {
    const res = await fetch(eventsUrl(calendarId, eventId), {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(toGoogleEventBody(event)),
    });
    if (!res.ok) {
      throw new Error(`Google Calendar updateEvent failed: ${res.status} ${await res.text()}`);
    }
  }

  async cancelEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    const res = await fetch(eventsUrl(calendarId, eventId), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // 404/410 — the event is already gone (deleted directly in Google
    // Calendar, say). That's the outcome we wanted anyway, not a failure.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Google Calendar cancelEvent failed: ${res.status} ${await res.text()}`);
    }
  }
}

export const calendarProvider: CalendarProvider = new GoogleCalendarProvider();
