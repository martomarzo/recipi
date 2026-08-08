import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import RecetaForm from "@/components/recetas/RecetaForm";

export default async function NuevaRecetaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <RecetaForm mode="crear" />;
}
