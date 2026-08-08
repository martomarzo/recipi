import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ImportarClient from "@/components/recetas/ImportarClient";

export default async function ImportarRecetaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <ImportarClient />;
}
