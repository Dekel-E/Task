import { redirect } from "next/navigation";

import { ProfileEditor } from "@/components/profile-editor";
import { getUser } from "@/lib/auth";

export default async function ProfilePage() {
  const me = await getUser();
  if (!me) redirect("/login");
  return <ProfileEditor />;
}
