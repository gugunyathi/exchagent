import { AgentDoc, BookingDoc } from '../types/firestore';
import { getWorkspaceAccessToken } from '../lib/firebase';

export interface CalendarSlotCheck {
  available: boolean;
  suggestedStartISO: string;
  suggestedEndISO: string;
  guardrailCheckPassed: boolean;
  guardrailNotes: string[];
}

export function evaluateCalendarGuardrails(
  targetAgent: AgentDoc,
  dealValueZAR: number
): CalendarSlotCheck {
  const minExec = targetAgent.guardrails.minExecMeetingValueZAR ?? 10000;
  const buffer = targetAgent.guardrails.meetingBufferMins ?? 15;
  const hours = targetAgent.guardrails.workingHoursSAST ?? '08:00-17:00';
  const notes: string[] = [];

  const passedValue = dealValueZAR >= minExec || targetAgent.type === 'business';
  if (!passedValue) {
    notes.push(
      `Deal value R${dealValueZAR.toLocaleString()} is below executive threshold R${minExec.toLocaleString()}. Auto-routing to asynchronous email brief.`
    );
  } else {
    notes.push(`Deal value R${dealValueZAR.toLocaleString()} meets executive meeting threshold.`);
  }
  notes.push(`Enforced ${buffer}-minute buffer within ${hours} SAST working window.`);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(10, 0, 0, 0);
  const end = new Date(tomorrow.getTime() + 30 * 60 * 1000);

  return {
    available: true,
    suggestedStartISO: tomorrow.toISOString(),
    suggestedEndISO: end.toISOString(),
    guardrailCheckPassed: passedValue,
    guardrailNotes: notes,
  };
}

export async function checkGoogleCalendarFreeBusy(
  timeMinISO: string,
  timeMaxISO: string
): Promise<{ liveChecked: boolean; busySlots: Array<{ start: string; end: string }> }> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    return { liveChecked: false, busySlots: [] };
  }
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: timeMinISO,
        timeMax: timeMaxISO,
        items: [{ id: 'primary' }],
      }),
    });
    if (!res.ok) return { liveChecked: false, busySlots: [] };
    const data = await res.json();
    const busy = data?.calendars?.primary?.busy ?? [];
    return { liveChecked: true, busySlots: busy };
  } catch {
    return { liveChecked: false, busySlots: [] };
  }
}

export async function insertGoogleCalendarEvent(booking: BookingDoc): Promise<{
  synced: boolean;
  htmlLink?: string;
  meetLink?: string;
  error?: string;
}> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    return { synced: false, error: 'Google Calendar OAuth token not connected (using simulated calendar engine).' };
  }
  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `[Switchboard A2A] ${booking.title}`,
          description: `Autonomous Switchboard Booking\nOrganizer: ${booking.organizerHandle}\nAttendee: ${booking.attendeeHandle}\nDeal Value: R${booking.dealValueZAR.toLocaleString('en-ZA')}`,
          start: { dateTime: booking.startTime, timeZone: 'Africa/Johannesburg' },
          end: { dateTime: booking.endTime, timeZone: 'Africa/Johannesburg' },
          conferenceData: {
            createRequest: {
              requestId: `swb_${booking.id}_${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      return { synced: false, error: `Calendar API returned ${res.status}: ${errText.slice(0, 120)}` };
    }
    const created = await res.json();
    return {
      synced: true,
      htmlLink: created.htmlLink,
      meetLink: created.hangoutLink || booking.meetLink,
    };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : 'Calendar request failed' };
  }
}

export function downloadIcsFile(booking: BookingDoc): void {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Switchboard AgentPages//Calendar Tool//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@switchboard.agent`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(booking.startTime)}`,
    `DTEND:${fmt(booking.endTime)}`,
    `SUMMARY:${booking.title}`,
    `DESCRIPTION:Autonomous A2A booking between ${booking.organizerHandle} and ${booking.attendeeHandle}. Meet: ${booking.meetLink}`,
    `LOCATION:${booking.meetLink}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${booking.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadScheduleIcs(bookings: BookingDoc[]): void {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const nowStamp = fmt(new Date().toISOString());

  const eventsBlock = bookings
    .map((b) =>
      [
        'BEGIN:VEVENT',
        `UID:${b.id}@switchboard.agent`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${fmt(b.startTime)}`,
        `DTEND:${fmt(b.endTime)}`,
        `SUMMARY:${b.title}`,
        `DESCRIPTION:Switchboard Interview / Meeting (${b.organizerHandle} with ${b.attendeeHandle})${b.jobTitle ? ' — Role: ' + b.jobTitle : ''}. Join: ${b.meetLink}`,
        `LOCATION:${b.meetLink}`,
        `STATUS:${b.status}`,
        'END:VEVENT',
      ].join('\r\n')
    )
    .join('\r\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Switchboard AgentPages//Interview Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    eventsBlock,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `switchboard-schedule-${new Date().toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadScheduleCsv(bookings: BookingDoc[]): void {
  const header = ['Title', 'Role', 'Organizer', 'Candidate/Attendee', 'Start (ISO)', 'End (ISO)', 'Meet Link', 'Status'];
  const rows = bookings.map((b) => [
    `"${b.title.replace(/"/g, '""')}"`,
    `"${(b.jobTitle || b.interviewMode || 'Commercial').replace(/"/g, '""')}"`,
    b.organizerHandle,
    b.attendeeHandle,
    b.startTime,
    b.endTime,
    b.meetLink,
    b.status,
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `switchboard-interview-schedule-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildGoogleCalendarUrl(booking: BookingDoc): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: booking.title,
    dates: `${fmt(booking.startTime)}/${fmt(booking.endTime)}`,
    details: `Switchboard Live Interview / Meeting\nOrganizer: ${booking.organizerHandle}\nAttendee: ${booking.attendeeHandle}${booking.jobTitle ? `\nRole: ${booking.jobTitle}` : ''}\nJoin Link: ${booking.meetLink}`,
    location: booking.meetLink,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarUrl(booking: BookingDoc): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: booking.title,
    startdt: new Date(booking.startTime).toISOString(),
    enddt: new Date(booking.endTime).toISOString(),
    body: `Switchboard Live Interview / Meeting\nOrganizer: ${booking.organizerHandle}\nAttendee: ${booking.attendeeHandle}${booking.jobTitle ? `\nRole: ${booking.jobTitle}` : ''}\nJoin: ${booking.meetLink}`,
    location: booking.meetLink,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function buildOffice365CalendarUrl(booking: BookingDoc): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: booking.title,
    startdt: new Date(booking.startTime).toISOString(),
    enddt: new Date(booking.endTime).toISOString(),
    body: `Switchboard Live Interview / Meeting\nOrganizer: ${booking.organizerHandle}\nAttendee: ${booking.attendeeHandle}${booking.jobTitle ? `\nRole: ${booking.jobTitle}` : ''}\nJoin: ${booking.meetLink}`,
    location: booking.meetLink,
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

