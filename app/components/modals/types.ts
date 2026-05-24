import type { Id } from "@/convex/_generated/dataModel";

export interface ModalTheme {
  _id: Id<"themes">;
  name: string;
  wordCount: number;
}
