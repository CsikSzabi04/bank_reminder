import { describe, expect, it } from "vitest";
import { csvCell, exportFilename, isCsvTable, toCsv } from "@/lib/export";

describe("csvCell", () => {
  it("üres, szám, logikai", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(2990.5)).toBe("2990.5");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(true)).toBe("true");
  });
  it("idézőjel, vessző, sortörés escape-elve (RFC 4180)", () => {
    expect(csvCell('a "b" c')).toBe('"a ""b"" c"');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("sima")).toBe("sima");
  });
  it("🔴 képlet-injekció: = + - @ tab CR kezdetű szöveg aposztróf-előtagot kap", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      expect(csvCell(evil).replace(/^"/, "").startsWith("'")).toBe(true);
    }
    expect(csvCell("=1+1")).toBe("'=1+1");
    // a közepén álló jel nem érinti
    expect(csvCell("a=b")).toBe("a=b");
  });
  it("tömb és objektum JSON-ként", () => {
    expect(csvCell([0, 1])).toBe('"[0,1]"');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
});

describe("toCsv", () => {
  it("fejléc = a kulcsok uniója, CRLF, hiányzó mező üres", () => {
    expect(toCsv([{ a: 1, b: "x" }, { a: 2, c: "y" }])).toBe("a,b,c\r\n1,x,\r\n2,,y\r\n");
  });
  it("üres lista: csak a (üres) fejléc-sor", () => {
    expect(toCsv([])).toBe("\r\n");
  });
});

describe("exportFilename / isCsvTable", () => {
  it("a dátum az exported_at-ból", () => {
    expect(exportFilename("json", "2026-10-14T08:00:00Z")).toBe("bank-reminder-2026-10-14.json");
    expect(exportFilename("reminders", "2026-10-14T08:00:00Z")).toBe("bank-reminder-reminders-2026-10-14.csv");
    expect(exportFilename("expenses", "")).toBe("bank-reminder-expenses-export.csv");
  });
  it("csak a megengedett táblák", () => {
    expect(isCsvTable("reminders")).toBe(true);
    expect(isCsvTable("profiles")).toBe(false);
    expect(isCsvTable(null)).toBe(false);
  });
});
