import type { NextAuthConfig } from "next-auth"

// We define the edge-friendly config here.
// The database adapter and Credentials provider will be added in auth.ts.
export default {
  providers: [], // Configured in auth.ts
  pages: {
    signIn: '/auth',
  },
  callbacks: {
    // Attach the user's role and permissions from DB into the JWT during sign-in
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'student'; // 'student' by default
        token.permissions = (user as any).permissions || [];
        token.status = (user as any).status || 'نشط';
        token.instance_id = (user as any).instance_id || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).permissions = token.permissions;
        (session.user as any).status = token.status as string;
        (session.user as any).instance_id = token.instance_id;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
