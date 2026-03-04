import { redirect } from 'next/navigation';

export default function AdminIndex() {
  // Redirect bare /admin to the admin dashboard
  redirect('/admin/dashboard');
}
