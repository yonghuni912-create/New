import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { createClient } from '@libsql/client';

// Turso 클라이언트 생성
function getDbClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('🔐 Login attempt:', credentials?.email);
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          console.log('🔗 Connecting to Turso:', process.env.TURSO_DATABASE_URL);
          const db = getDbClient();
          const result = await db.execute({
            sql: 'SELECT * FROM User WHERE email = ?',
            args: [credentials.email],
          });

          console.log('📊 Query result rows:', result.rows.length);
          const user = result.rows[0];
          if (!user) {
            console.log('❌ User not found');
            return null;
          }

          console.log('👤 Found user:', user.email);
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password as string
          );

          console.log('🔑 Password valid:', isPasswordValid);
          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string,
            role: user.role as string,
          };
        } catch (error) {
          console.error('❌ Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
