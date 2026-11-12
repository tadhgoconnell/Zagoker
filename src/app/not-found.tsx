import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-gold-gradient font-display text-7xl font-bold">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold">
        This hand was folded
      </h1>
      <p className="mt-3 max-w-md text-mist">
        The page you are looking for does not exist or has moved.
      </p>
      <ButtonLink href={routes.home} className="mt-8">
        Back to home
      </ButtonLink>
    </Container>
  );
}
