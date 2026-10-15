import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { OpenLink } from "@/components/reminders/open-link";
import hu from "@/locales/hu.json";
import en from "@/locales/en.json";

afterEach(cleanup);

const view = (url: string | null | undefined, locale: "hu" | "en" = "hu") =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "hu" ? hu : en}>
      <OpenLink url={url} name="Claude" />
    </NextIntlClientProvider>,
  );

describe("OpenLink — „Megnyitás ↗”", () => {
  it("érvényes https-hivatkozás: új lapon, noopener noreferrer, a gazdagép a hozzáférhető névben", () => {
    view("https://claude.ai/upgrade");
    const link = screen.getByRole("link", { name: "Claude megnyitása új lapon (claude.ai)" });
    expect(link).toHaveAttribute("href", "https://claude.ai/upgrade");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link).toHaveTextContent("Megnyitás");
  });

  it("http is megengedett; a felirat angolul is helyes", () => {
    view("http://example.com/x", "en");
    expect(screen.getByRole("link", { name: "Open Claude in a new tab (example.com)" })).toHaveAttribute("href", "http://example.com/x");
  });

  it("veszélyes vagy érvénytelen érték mellett semmit nem renderel (javascript:, data:, üres, megtévesztő felhasználónév)", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "", null, undefined, "https://bank.hu@evil.example", "nem url"]) {
      const { container, unmount } = view(bad);
      expect(container.querySelector("a"), String(bad)).toBeNull();
      unmount();
    }
  });
});
