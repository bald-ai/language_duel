"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function Home() {
  const users = useQuery(api.users.getUsers);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">Hello World</h1>
        <p className="text-xl text-gray-600 mb-4">Welcome to your Next.js app!</p>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2">Convex Test</h2>
          {users === undefined ? (
            <p>Loading users...</p>
          ) : (
            <p>Found {users.length} users in database</p>
          )}
        </div>
      </div>
    </div>
  );
}
