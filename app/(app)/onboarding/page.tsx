import { redirect } from "next/navigation";

// Ideiglenes: az onboarding (3 lépés) a B-26 feladat; addig a megerősítés után a Főoldalra jutunk
export default function OnboardingPage() {
  redirect("/dashboard");
}
