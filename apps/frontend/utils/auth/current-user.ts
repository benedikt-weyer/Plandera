import { getBackend } from "@/utils/api/backend-interface";
import { AuthUser } from "@/utils/api/types";

/**
 * Get the current authenticated user
 * @returns Promise<AuthUser | null>
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const backend = getBackend();
    const { data: { user } } = await backend.auth.getUser();
    return user;
  } catch (error) {
    console.warn('Failed to get current user:', error);
    return null;
  }
}

/**
 * Get the current user's ID
 * @returns Promise<string | null>
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}
