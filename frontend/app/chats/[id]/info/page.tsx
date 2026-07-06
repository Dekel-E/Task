import { redirect } from "next/navigation";

import { GroupInfo } from "@/components/group-info";
import { getUser } from "@/lib/auth";

export default async function GroupInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getUser();
  if (!me) redirect("/login");
  return <GroupInfo conversationId={id} meId={me.id} />;
}
