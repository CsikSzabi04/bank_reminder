"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import { TextField } from "@/components/auth/text-field";
import { fold } from "@/lib/reminders/group";
import { cn } from "@/lib/utils";

export type CatalogItem = { slug: string; name: string; categoryKey: string };

const MAX_SUGGESTIONS = 6;

// Név-mező katalógus-javaslatokkal (combobox, ARIA 1.2). A katalógus csak nevet/kategóriát ad:
// ár nincs benne (H7: nincs kitalált adat), az összeget a felhasználó írja be.
export function ServicePicker({
  value,
  catalog,
  errors,
  translateError,
  onType,
  onSelect,
}: {
  value: string;
  catalog: CatalogItem[];
  errors?: string[];
  translateError: (code: string | undefined) => string;
  onType: (text: string) => void;
  onSelect: (item: CatalogItem) => void;
}) {
  const t = useTranslations("reminders.form");
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const query = fold(value.trim());
  const matches = query
    ? catalog.filter((c) => fold(c.name).includes(query) && fold(c.name) !== query).slice(0, MAX_SUGGESTIONS)
    : [];
  const expanded = open && matches.length > 0;
  const optionId = (i: number) => `${listId}-${i}`;

  const choose = (item: CatalogItem) => {
    onSelect(item);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!expanded) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault(); // ne küldje el az űrlapot, a javaslatot választja
      choose(matches[Math.min(active, matches.length - 1)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <TextField
        name="name"
        label={t("name")}
        placeholder={t("namePlaceholder")}
        value={value}
        autoComplete="off"
        maxLength={80}
        required
        errors={errors}
        translateError={translateError}
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? optionId(Math.min(active, matches.length - 1)) : undefined}
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("serviceList")}
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-control border border-border bg-surface shadow-card"
        >
          {matches.map((item, i) => (
            <li
              key={item.slug}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // mousedown: a blur előtt választ (különben a lista bezárulna a kattintás előtt)
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              className={cn("flex min-h-11 cursor-pointer items-center px-4", i === active ? "bg-primary-soft text-primary-text" : "hover:bg-surface-2")}
            >
              {item.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
