import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}
