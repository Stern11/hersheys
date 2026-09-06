/**
 * The front door.
 *
 * A server component purely so it can read whether the deployment actually has
 * Google credentials. That decides what the button does, and the answer must
 * come from the server — `AUTH_GOOGLE_ID` is not, and should not be, readable
 * in the browser.
 */

import { googleConfigured } from "@/auth";
import { WelcomeScreen } from "@/components/layout/welcome-screen";

export default function WelcomePage() {
  return <WelcomeScreen googleEnabled={googleConfigured} />;
}
