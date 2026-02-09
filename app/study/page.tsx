import { Suspense } from "react";
import StudyPageClient from "./StudyPageClient";

export default function StudyPage() {
  return (
    <Suspense fallback={null}>
      <StudyPageClient />
    </Suspense>
  );
}

