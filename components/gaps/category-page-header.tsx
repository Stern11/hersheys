import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { GapCategoryDef } from "./gap-category";

export function CategoryPageHeader({ category }: { category: GapCategoryDef }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Link href="/gaps" className="flex w-fit items-center gap-1 text-[11.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ChevronLeft className="size-3" /> Planning Gaps
      </Link>
      <h1 className="text-[17px] font-semibold">{category.label}</h1>
      <p className="max-w-xl text-[13px] text-[var(--text-secondary)]">{category.question}</p>
    </div>
  );
}
