import type { CategoryView } from "@/lib/category-icons";
import type { ListItem } from "@/lib/reminders/group";
import { BillList, BillRow } from "./bill-row";
import { NotifyToggle } from "./notify-toggle";
import { OccurrencePayButton } from "./occurrence-pay-button";
import { RecurrenceText } from "./recurrence-text";
import { RowMenu } from "./row-menu";

// Egy csoport sorai a valós műveletekkel: Kifizettem · 🔔 · ⋯ menü
export function ReminderRows({
  items,
  categories,
  today,
  label,
}: {
  items: ListItem[];
  categories: Map<string, CategoryView>;
  today: string;
  label: string;
}) {
  return (
    <BillList label={label}>
      {items.map(({ reminder: r, next }) => (
        <BillRow
          key={r.id}
          href={`/reminders/${r.id}`}
          name={r.name}
          // a következő esedékesség összege (árváltozás után eltérhet az emlékeztető alap-összegétől)
          amount={next?.amount ?? r.amount}
          currency={next?.currency ?? r.currency}
          dueDate={next?.due_date ?? r.start_date}
          today={today}
          status={!r.is_active ? "paused" : next ? "upcoming" : "done"}
          category={r.category_id ? categories.get(r.category_id) : null}
          demo={r.is_demo}
          notifyOff={!r.remind_enabled}
          subtitle={<RecurrenceText unit={r.recur_unit} every={r.recur_every} startDate={r.start_date} monthEnd={r.month_end} />}
          action={
            <>
              {next && r.is_active && <OccurrencePayButton occurrenceId={next.id} name={r.name} />}
              <NotifyToggle reminderId={r.id} enabled={r.remind_enabled} name={r.name} />
              <RowMenu reminderId={r.id} occurrenceId={next?.id ?? null} name={r.name} active={r.is_active} />
            </>
          }
        />
      ))}
    </BillList>
  );
}
