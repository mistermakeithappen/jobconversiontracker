import { redirect } from "next/navigation";

export default async function Home() {
  // Redirect to GHL overview (middleware will handle auth check)
  redirect("/ghl");
}