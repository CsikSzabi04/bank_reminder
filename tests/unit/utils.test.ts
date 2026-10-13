import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("összevonja az osztályokat és a Tailwind-ütközést feloldja", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
