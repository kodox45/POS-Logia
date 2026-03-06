// System page: Unauthorized — Guard redirect target for RoleGuard
import { useNavigate } from 'react-router-dom';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg p-8 max-w-sm w-full shadow-lg border border-border text-center">
        <h1 className="text-2xl font-semibold text-error mb-4">Akses Ditolak</h1>
        <p className="text-text-secondary mb-6">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded font-medium transition-colors"
        >
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );
}
