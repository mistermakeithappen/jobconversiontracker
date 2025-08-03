import Navbar from '@/components/ui/Navbar';
import AuthGuard from '@/components/auth-guard';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main>{children}</main>
      </div>
    </AuthGuard>
  );
}