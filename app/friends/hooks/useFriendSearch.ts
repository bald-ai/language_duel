"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SEARCH_DEBOUNCE_MS } from "../constants";

export function useFriendSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Only query when we have a search term
  const results = useQuery(
    api.users.searchUsers,
    debouncedSearchTerm ? { searchTerm: debouncedSearchTerm } : "skip"
  );

  const isSearching = searchTerm.trim() !== debouncedSearchTerm;

  return {
    searchTerm,
    setSearchTerm,
    results: results ?? [],
    isSearching,
    hasSearched: debouncedSearchTerm.length > 0,
  };
}
