export interface Notification {
  id: string;
  eventType: string;
  title: string;
  message: string;
  relatedResourceType: string | null;
  relatedResourceId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  eventType: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
}

// Handbook §7.2 event catalog — used to render a friendly label and let the
// user toggle email delivery per event type even before any event of that
// type has fired yet (no preference row exists until the first toggle).
export const NOTIFICATION_EVENT_TYPES: Array<{ value: string; label: string }> = [
  { value: "leave.request.submitted", label: "Leave request submitted (HR)" },
  { value: "leave.request.decided", label: "Leave request decided" },
  { value: "overtime.request.decided", label: "Overtime request decided" },
  { value: "payroll.run.released", label: "Payslip released" },
  { value: "expense.claim.decided", label: "Expense claim decided" },
  { value: "recruitment.interview.scheduled", label: "Interview scheduled" },
  { value: "recruitment.offer.responded", label: "Offer response received (HR)" },
];
