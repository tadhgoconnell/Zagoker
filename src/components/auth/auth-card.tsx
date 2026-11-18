import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Container className="flex flex-1 items-center justify-center py-12 sm:py-20">
      <div className="w-full max-w-md animate-fade-up">
        <Panel className="p-6 sm:p-9">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-mist">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </Panel>
        {footer && (
          <p className="mt-6 text-center text-sm text-mist">{footer}</p>
        )}
      </div>
    </Container>
  );
}
