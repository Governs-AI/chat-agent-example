import NextAuth from "next-auth";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    {
      id: "governsai",
      name: "GovernsAI",
      type: "oidc",
      issuer: process.env.GOVERNSAI_ISSUER,
      clientId: process.env.GOVERNSAI_CLIENT_ID,
      clientSecret: process.env.GOVERNSAI_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          // Extract custom GovernsAI claims
          governs_user_id: profile.governs_user_id,
          org_id: profile.org_id,
          org_slug: profile.org_slug,
          org_role: profile.org_role,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, profile, account }) {
      // Store custom claims in JWT token on initial sign in
      if (profile) {
        token.governs_user_id = profile.governs_user_id;
        token.org_id = profile.org_id;
        token.org_slug = profile.org_slug;
        token.org_role = profile.org_role;
      }
      if (account) {
        token.access_token = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Include custom claims in session
      if (session.user) {
        (session.user as any).governs_user_id = token.governs_user_id;
        (session.user as any).org_id = token.org_id;
        (session.user as any).org_slug = token.org_slug;
        (session.user as any).org_role = token.org_role;
        (session.user as any).access_token = token.access_token;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
});

