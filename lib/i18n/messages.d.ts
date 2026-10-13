import type hu from "../../locales/hu.json";
import type { Locale } from "./config";

// Tipizált üzenetkulcsok: a HU a forrás-igazság (§20.1)
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof hu;
  }
}
