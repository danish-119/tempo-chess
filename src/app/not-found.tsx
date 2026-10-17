import { ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="font-serif text-6xl font-semibold text-accent">404</p>
      <h1 className="font-serif text-2xl font-semibold">This square is empty</h1>
      <p className="text-ink-2">The page you were looking for doesn&apos;t exist.</p>
      <div className="flex gap-2">
        <ButtonLink href="/" variant="primary">Home</ButtonLink>
        <ButtonLink href="/analyze">Analysis board</ButtonLink>
      </div>
    </div>
  );
}
