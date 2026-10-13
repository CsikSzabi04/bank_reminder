import { redirect } from "next/navigation";

// A proxy.ts úgyis átirányít (belépve → /dashboard, kilépve → /login); ez csak tartalék
export default function Home() {
  redirect("/dashboard");
}
