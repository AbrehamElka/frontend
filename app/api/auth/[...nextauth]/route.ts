import NextAuth, {
  NextAuthOptions,
  User as NextAuthUser,
  Session,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email("Invalid email address.").trim(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(100, "Password too long."),
});

// ✅ Define auth options separately for clarity and reusability
const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = credentialsSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          console.error("Invalid credentials:", parsedCredentials.error);
        }
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  jwt: {
    maxAge: 60 * 60 * 1,
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 1,
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: NextAuthUser }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user = {
          ...session.user,
          name: token.name ?? null,
          email: token.email ?? null,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin", // Custom sign-in page route
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// ✅ Required export for Next.js App Router compatibility
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
