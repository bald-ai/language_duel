import { AppErrorScreen } from "@/app/components/AppErrorScreen";

export default function NotFound() {
  return (
    <AppErrorScreen
      title="Page not found"
      message="That page is not available. It may have moved, or the link may be old."
    />
  );
}
