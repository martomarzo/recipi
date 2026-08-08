import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

// Landing: lista de dietas (se construye en la sección Dietas).
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  redirect('/dietas');
}
