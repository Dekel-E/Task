import { redirect } from "next/navigation";

import { TerminalList } from "@/components/terminal-list";
import { getUser } from "@/lib/auth";

export default async function TerminalsPage() {
  const me = await getUser();
  if (!me) redirect("/login");
  return <TerminalList meId={me.id} />;
}
