"use client";

import { useRouter } from "next/navigation";
import { OpenLink } from "@/components/reminders/open-link";
import { markNotificationsRead } from "@/lib/push/actions";
import { cn } from "@/lib/utils";

// Koppintás: olvasottnak jelöl (nem várjuk meg), majd a mély linkre visz (§12.13)
export function NotificationItem({
  id,
  unread,
  unreadLabel,
  title,
  body,
  time,
  url,
  externalUrl,
  externalName,
}: {
  id: string;
  unread: boolean;
  unreadLabel: string;
  title: string;
  body: string;
  time: string;
  url: string;
  /** az emlékeztető külső hivatkozása („Megnyitás ↗"); csak számla-értesítésnél */
  externalUrl?: string;
  externalName?: string;
}) {
  const router = useRouter();
  return (
    <li>
      <a
        href={url}
        onClick={(e) => {
          e.preventDefault();
          if (unread) void markNotificationsRead([id]);
          router.push(url);
        }}
        className={cn("flex items-start gap-3 px-4 py-3 hover:bg-surface-2", unread && "bg-primary-soft/40")}
      >
        {/* az olvasatlan állapotot pötty ÉS szöveg jelzi */}
        <span aria-hidden className={cn("mt-2 size-2.5 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} />
        <span className="min-w-0 flex-1">
          <span className={cn("block", unread ? "font-semibold" : "font-medium")}>
            {unread && <span className="sr-only">{unreadLabel}: </span>}
            {title}
          </span>
          {body && <span className="block text-sm text-text-2">{body}</span>}
        </span>
        <time className="shrink-0 text-sm text-text-muted">{time}</time>
      </a>
      {externalUrl && (
        <div className="px-4 pb-3 pl-9">
          <OpenLink url={externalUrl} name={externalName ?? ""} />
        </div>
      )}
    </li>
  );
}
