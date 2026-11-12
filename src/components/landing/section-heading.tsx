export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-[0.25em] text-gold-400 uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-bold text-balance sm:text-4xl">
        {title}
      </h2>
      {children && (
        <p className="mt-4 leading-relaxed text-pretty text-mist">{children}</p>
      )}
    </div>
  );
}
