import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getUserFromSession } from "@/lib/auth";

/** Root URL: no marketing page — send users straight into the app. */
export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value ?? null;
  const user = await getUserFromSession(token);
  redirect(user ? "/dashboard" : "/login");
}
