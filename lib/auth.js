import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, schema } from './db';

import { resolveRole } from './admin';

const { users, accounts, sessions, verificationTokens, creditWallets } = schema;

function buildProviders() {
  const providers = [
    Credentials({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '').trim().toLowerCase();
        const password = String(credentials?.password || '');
        if (!email || !password) return null;

        const db = getDb();
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: resolveRole(user.email, user.role),
        };
      },
    }),
  ];

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      })
    );
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      })
    );
  }

  return providers;
}

function getAdapter() {
  if (!process.env.DATABASE_URL) return undefined;
  return DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: getAdapter(),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = resolveRole(user.email, user.role);
        token.email = user.email;
      } else if (token.email) {
        token.role = resolveRole(token.email, token.role);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = resolveRole(session.user.email || token.email, token.role);
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user?.id) return;
      try {
        const db = getDb();
        await db
          .insert(creditWallets)
          .values({ userId: user.id, balance: 0 })
          .onConflictDoNothing();
      } catch (err) {
        console.error('[auth] wallet create failed', err);
      }
    },
  },
  trustHost: true,
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return session.user;
}
