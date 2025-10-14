'use client';

import { useSession, signOut } from "next-auth/react";

export function UserInfo() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const user = session.user as any;

  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <div className="text-sm font-medium text-gray-900">
          {user.name || user.email}
        </div>
        {user.org_slug && (
          <div className="text-xs text-gray-500">
            {user.org_slug} {user.org_role && `• ${user.org_role}`}
          </div>
        )}
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
      >
        Logout
      </button>
    </div>
  );
}

