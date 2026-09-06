import { redirect } from "next/navigation";

export default function RootPage() {
  // The front door. Signed-in planners are bounced onward from there, so the
  // decision about where they land lives in one place rather than two.
  redirect("/welcome");
}
