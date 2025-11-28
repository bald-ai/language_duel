"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { AuthButtons } from "@/components/auth";
import { useSyncUser } from "@/hooks/useSyncUser";

export default function Home() {
  const { isSignedIn, user } = useUser();
  const users = useQuery(api.users.getUsers);
  const vocabulary = useQuery(api.vocabulary.getVocabulary);
  
  useSyncUser();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="absolute top-4 right-4">
          <AuthButtons />
        </div>
        
        {isSignedIn ? (
          <>
            <h1 className="text-6xl font-bold text-gray-900 mb-4">
              Hello, {user?.firstName || "User"}!
            </h1>
            <p className="text-xl text-gray-600 mb-4">Welcome to your Next.js app!</p>
          </>
        ) : (
          <>
            <h1 className="text-6xl font-bold text-gray-900 mb-4">Hello World</h1>
            <p className="text-xl text-gray-600 mb-4">Please sign in to continue</p>
          </>
        )}
        
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2">Convex Test</h2>
          {users === undefined ? (
            <p>Loading users...</p>
          ) : (
            <p>Found {users.length} users in database</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md mt-4">
          <h2 className="text-lg font-semibold mb-2">Vocabulary Database</h2>
          {vocabulary === undefined ? (
            <p>Loading vocabulary...</p>
          ) : (
            <p>Found {vocabulary.length} vocabulary words</p>
          )}
        </div>
      </div>
    </div>
  );
}
