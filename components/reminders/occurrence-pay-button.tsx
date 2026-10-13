"use client";

import { markPaid, markUnpaid } from "@/lib/reminders/actions";
import { PayButton } from "./pay-button";

// A PayButton a valós Server Action-ökkel bekötve (a PayButton maga fixture-rel is használható)
export function OccurrencePayButton({ occurrenceId, name }: { occurrenceId: string; name: string }) {
  return (
    <PayButton
      status="upcoming"
      name={name}
      onPay={() => markPaid(occurrenceId)}
      onUndo={() => markUnpaid(occurrenceId)}
    />
  );
}
