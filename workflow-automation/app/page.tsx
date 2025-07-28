import { redirect } from "next/navigation";

export default async function Home() {
  // For now, always redirect to dashboard
  redirect("/dashboard");
}