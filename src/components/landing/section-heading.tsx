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
    <div className="max-w-2xl">
      <p className="font-mono text-xs tracking-widest text-accent-400 uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 leading-relaxed text-pretty text-mist">{children}</p>}
    </div>
  );
}
