import type { ReactNode } from "react";
export function PageIntro({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="container page-intro">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
