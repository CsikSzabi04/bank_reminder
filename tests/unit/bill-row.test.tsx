import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { BillList, BillRow, type BillRowProps } from "@/components/reminders/bill-row";
import { RecurrenceText } from "@/components/reminders/recurrence-text";
import { FIXTURE_CATEGORIES, FIXTURE_TODAY } from "@/lib/fixtures/reminders";
import en from "@/locales/en.json";
import hu from "@/locales/hu.json";

afterEach(cleanup);

const norm = (s: string | null) => (s ?? "").replace(/[  ]/g, " ");

function renderRow(props: Partial<BillRowProps> = {}, locale: "hu" | "en" = "hu") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "hu" ? hu : en}>
      <BillList>
        <BillRow
          name="Netflix"
          amount={2300}
          currency="HUF"
          dueDate="2026-10-14"
          today={FIXTURE_TODAY}
          status="upcoming"
          category={FIXTURE_CATEGORIES.streaming}
          {...props}
        />
      </BillList>
    </NextIntlClientProvider>,
  );
}

describe("BillRow", () => {
  it("közeli esedékesség: név, formázott összeg, „holnap”", () => {
    renderRow();
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Netflix")).toBeInTheDocument();
    expect(norm(item.textContent)).toContain("2 300 Ft");
    expect(item).toHaveTextContent("holnap");
  });

  it("lejárt: szöveg ÉS ikon jelzi (nem csak szín): „Lejárt · tegnap”", () => {
    renderRow({ dueDate: "2026-10-12" });
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Lejárt · tegnap");
    expect(item.querySelector("svg.lucide-circle-alert, svg.lucide-alert-circle")).not.toBeNull();
  });

  it("kifizetett és kihagyott: állapotszöveg, a kihagyott név áthúzott", () => {
    const { unmount } = renderRow({ status: "paid", dueDate: "2026-10-05" });
    expect(screen.getByRole("listitem")).toHaveTextContent("Kifizetve");
    unmount();
    renderRow({ status: "skipped", dueDate: "2026-10-08" });
    expect(screen.getByRole("listitem")).toHaveTextContent("Kihagyva");
    expect(screen.getByText("Netflix")).toHaveClass("line-through");
  });

  it("távoli dátum konkrét dátumként jelenik meg, nem „42 nap múlva”", () => {
    renderRow({ dueDate: "2027-03-02" });
    expect(norm(screen.getByRole("listitem").textContent)).toContain("2027. márc. 2.");
  });

  it("minta-adat jelvény és kikapcsolt értesítés jelzése", () => {
    renderRow({ demo: true, notifyOff: true });
    expect(screen.getByText("Minta adat")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Az értesítés ki van kapcsolva" })).toBeInTheDocument();
  });

  it("href esetén a sor linkel; anélkül nem", () => {
    const { unmount } = renderRow({ href: "/reminders/abc" });
    expect(screen.getByRole("link")).toHaveAttribute("href", "/reminders/abc");
    unmount();
    renderRow();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("angol nyelven az összeg és a felirat angol", () => {
    renderRow({}, "en");
    const item = screen.getByRole("listitem");
    expect(norm(item.textContent)).toContain("HUF 2,300");
    expect(item).toHaveTextContent("tomorrow");
  });
});

describe("RecurrenceText", () => {
  const text = (props: React.ComponentProps<typeof RecurrenceText>, locale: "hu" | "en" = "hu") => {
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={locale === "hu" ? hu : en}>
        <RecurrenceText {...props} />
      </NextIntlClientProvider>,
    );
    const out = container.textContent;
    cleanup();
    return out;
  };

  it("magyar felirat", () => {
    expect(text({ unit: "month", every: 1, startDate: "2026-01-10" })).toBe("havonta · 10. napján");
    expect(text({ unit: "month", every: 2, startDate: "2026-01-10" })).toBe("2 havonta · 10. napján");
    expect(text({ unit: "month", every: 1, startDate: "2026-01-31", monthEnd: true })).toBe("havonta · hónap utolsó napján");
    expect(text({ unit: "week", every: 1, startDate: "2026-10-12" })).toBe("hetente · hétfő");
    expect(text({ unit: "year", every: 1, startDate: "2026-11-10" })).toBe("évente · nov. 10.");
    expect(text({ unit: null, every: 1, startDate: "2026-11-10" })).toBe("egyszeri");
  });

  it("angol felirat sorszámnévvel", () => {
    expect(text({ unit: "month", every: 1, startDate: "2026-01-10" }, "en")).toBe("monthly · on the 10th");
    expect(text({ unit: "month", every: 1, startDate: "2026-01-01" }, "en")).toBe("monthly · on the 1st");
    expect(text({ unit: "month", every: 3, startDate: "2026-01-22" }, "en")).toBe("every 3 months · on the 22nd");
    expect(text({ unit: "month", every: 1, startDate: "2026-01-23" }, "en")).toBe("monthly · on the 23rd");
  });
});
