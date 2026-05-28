import type { Id } from "@/convex/_generated/dataModel";

export interface ModalTheme {
  _id: Id<"themes">;
  name: string;
  contentType: "word" | "sentence";
  /** Words for `contentType: "word"`, rounds for `contentType: "sentence"`. */
  itemCount: number;
}
