import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";

// Entry point: send signed-in users to their chats, everyone else to login.
export default async function Home() {
  const me = await getUser();
  redirect(me ? "/chats" : "/login");
}
