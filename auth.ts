import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findFirst({
          where: { email: credentials.email as string },
        });

        if (!user || !user.encrypted_password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.encrypted_password
        );

        if (!isValid) {
          return null;
        }

        // Fetch role from profiles
        const profile = await prisma.profiles.findUnique({
          where: { id: user.id },
          select: { role: true },
        });

        const role = profile?.role || 'student';
        let permissions: any[] = [];
        let status = 'نشط';

        // If assistant, fetch permissions
        if (role === 'assistant') {
          const perms = await prisma.assistant_permissions.findMany({
            where: { profile_id: user.id },
            select: { resource: true, access_level: true },
          });
          
          permissions = perms
            .filter(p => p.access_level && p.access_level !== 'none')
            .map(p => ({
              resource: p.resource,
              access_level: p.access_level
            }));
        } else if (role === 'student') {
          const studentInfo = await prisma.students.findFirst({
            where: { user_id: user.id },
            select: { status: true },
          });
          if (studentInfo) {
            status = studentInfo.status;
          }
        }

        return {
          id: user.id,
          email: user.email,
          role: role,
          permissions: permissions,
          status: status,
          instance_id: user.instance_id,
        } as any;
      },
    }),
  ],
})
