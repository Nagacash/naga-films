import { auth } from '@/lib/auth';

export function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(String(email).trim().toLowerCase());
}

export function resolveRole(email, dbRole = 'user') {
  if (isAdminEmail(email)) return 'admin';
  return dbRole === 'admin' ? 'admin' : 'user';
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const role = resolveRole(session.user.email, session.user.role);
  if (role !== 'admin') {
    const err = new Error('Admin only');
    err.status = 403;
    throw err;
  }
  return { ...session.user, role: 'admin' };
}
