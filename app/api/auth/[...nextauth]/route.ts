/**
 * The OAuth callback endpoint. Auth.js owns both verbs; there is nothing of
 * ours to add here.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
