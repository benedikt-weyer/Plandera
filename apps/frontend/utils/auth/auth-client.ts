// Client-side authentication functions
import { hashPasswordForAuth } from "@/utils/cryptography/encryption";
import { getBackend } from "@/utils/api/backend-interface";

export const signUpClient = async (formData: FormData): Promise<{ error?: string; success?: string }> => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    const backend = getBackend();
    const { error } = await backend.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("Sign up error:", error);
      return { error };
    } else {
      return { success: "Account created successfully! You can now sign in." };
    }
  } catch (error) {
    console.error("Sign up error:", error);
    return { error: "An error occurred during sign up" };
  }
};

export const signInClient = async (formData: FormData): Promise<{ error?: string; success?: boolean }> => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const backend = getBackend();
    const authResponse = await backend.auth.signIn({
      email,
      password,
    });

    if (authResponse.error) {
      return { error: authResponse.error };
    }

    // Check if we have a valid session/user
    if (authResponse.session && authResponse.user) {
      return { success: true };
    }

    return { error: "Sign in failed" };
  } catch (error) {
    console.error("Sign in error:", error);
    return { error: "An error occurred during sign in" };
  }
};

export const forgotPasswordClient = async (formData: FormData): Promise<{ error?: string; success?: string }> => {
  const email = formData.get("email")?.toString();

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    const backend = getBackend();
    const { error } = await backend.auth.resetPasswordForEmail({
      email,
      redirectTo: `/auth/callback?redirect_to=/reset-password`,
    });

    if (error) {
      console.error("Reset password error:", error);
      return { error: "Could not reset password" };
    }

    return { success: "Check your email for a link to reset your password." };
  } catch (error) {
    console.error("Reset password error:", error);
    return { error: "An error occurred while resetting password" };
  }
};

export const resetPasswordClient = async (formData: FormData): Promise<{ error?: string; success?: string }> => {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return { error: "Password and confirm password are required" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  // Hash the new password for authentication
  const authHash = hashPasswordForAuth(password);

  try {
    const backend = getBackend();
    const { error } = await backend.auth.updatePassword({
      password: authHash,
    });

    if (error) {
      return { error: "Password update failed" };
    }

    return { success: "Password updated" };
  } catch (error) {
    console.error("Update password error:", error);
    return { error: "An error occurred while updating password" };
  }
};

export const signOutClient = async (): Promise<{ error?: string; success?: boolean }> => {
  try {
    const backend = getBackend();
    await backend.auth.signOut();

    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return { error: "Sign out failed" };
  }
};
