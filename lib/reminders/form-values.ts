import type { RecurrenceMode } from "@/lib/schemas/reminder";

// Az űrlap állapota (a beviteli mezők szövegként/logikaiként; a szerver a zod-sémával újra-validál)
export type FormValues = {
  name: string;
  amount: string;
  currency: string;
  categoryId: string;
  serviceSlug: string;
  isSubscription: boolean;
  recurrence: RecurrenceMode;
  recurEvery: number;
  recurUnit: "day" | "week" | "month" | "year";
  startDate: string;
  monthEnd: boolean;
  endDate: string;
  trialEndsOn: string;
  remindEnabled: boolean;
  offsets: number[];
  remindTime: string;
  channelPush: boolean;
  channelEmail: boolean;
  autoPaid: boolean;
  note: string;
  url: string;
  // Bank-egyeztetés kulcsszó (A-48); a szerkesztésnél külön, tűrő lekérdezésből (az oszlop a db:push előtt még nincs)
  bankMatch: string;
  usageTags: string[];
};

export type ProfileDefaults = {
  base_currency: string;
  default_offsets: number[];
  default_notify_time: string;
  channel_push: boolean;
  channel_email: boolean;
};

// Új emlékeztető: okos alapértékek (§1.2: értesítés 1 nappal előtte, 09:00), a profilból
export function defaultValues(today: string, profile: ProfileDefaults): FormValues {
  return {
    name: "",
    amount: "",
    currency: profile.base_currency,
    categoryId: "",
    serviceSlug: "",
    isSubscription: false,
    recurrence: "month",
    recurEvery: 1,
    recurUnit: "month",
    startDate: today,
    monthEnd: false,
    endDate: "",
    trialEndsOn: "",
    remindEnabled: true,
    offsets: profile.default_offsets.length ? [...profile.default_offsets] : [1],
    remindTime: profile.default_notify_time.slice(0, 5),
    channelPush: profile.channel_push,
    channelEmail: profile.channel_email,
    autoPaid: false,
    note: "",
    url: "",
    bankMatch: "",
    usageTags: [],
  };
}

export type ReminderRecord = {
  name: string;
  amount: number;
  currency: string;
  category_id: string | null;
  service_slug: string | null;
  is_subscription: boolean;
  recur_unit: string | null;
  recur_every: number;
  start_date: string;
  month_end: boolean;
  end_date: string | null;
  trial_ends_on: string | null;
  remind_enabled: boolean;
  remind_offsets: number[];
  remind_time: string;
  channels: string[];
  auto_paid: boolean;
  note: string | null;
  url: string | null;
  usage_tags: string[];
};

const isUnit = (u: string | null): u is FormValues["recurUnit"] => u === "day" || u === "week" || u === "month" || u === "year";

// DB-sor → űrlap. A (unit, every) pár visszaképezése módra a toRecurrence() fordítottja.
export function valuesFromReminder(r: ReminderRecord, bankMatch = ""): FormValues {
  let recurrence: RecurrenceMode;
  if (!isUnit(r.recur_unit)) recurrence = "once";
  else if (r.recur_every === 1 && r.recur_unit !== "day") recurrence = r.recur_unit;
  else recurrence = "custom";

  return {
    name: r.name,
    amount: String(r.amount),
    currency: r.currency,
    categoryId: r.category_id ?? "",
    serviceSlug: r.service_slug ?? "",
    isSubscription: r.is_subscription,
    recurrence,
    recurEvery: r.recur_every,
    recurUnit: isUnit(r.recur_unit) ? r.recur_unit : "month",
    startDate: r.start_date,
    monthEnd: r.month_end,
    endDate: r.end_date ?? "",
    trialEndsOn: r.trial_ends_on ?? "",
    remindEnabled: r.remind_enabled,
    offsets: [...r.remind_offsets].sort((a, b) => a - b),
    remindTime: r.remind_time.slice(0, 5),
    channelPush: r.channels.includes("push"),
    channelEmail: r.channels.includes("email"),
    autoPaid: r.auto_paid,
    note: r.note ?? "",
    url: r.url ?? "",
    bankMatch,
    usageTags: r.usage_tags,
  };
}
