// Date formatting helpers — EU format (day/month/year, 24h) everywhere, so the
// dashboard never shows month-first American dates.
const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const DATE_TIME_OPTS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTS,
  hour: "2-digit",
  minute: "2-digit",
};

// Date only, e.g. 24/05/2026.
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", DATE_OPTS);

// Date + time, e.g. 24/05/2026, 14:30.
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", DATE_TIME_OPTS);
