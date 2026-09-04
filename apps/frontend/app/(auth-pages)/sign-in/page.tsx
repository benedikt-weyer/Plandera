'use client';

import { signInClient } from "@/utils/auth/auth-client";

import { FormMessage as AuthFormMessage, Message } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { hashPasswordForAuth, hashPasswordForEncryption, storeEncryptionKey } from "@/utils/cryptography/encryption";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isSSOEnabled, redirectToSSOLogin } from "@/utils/auth/sso-utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Define the schema for form validation
const signInSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" })
});

type SignInFormValues = z.infer<typeof signInSchema>;

function SignInForm() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize react-hook-form with zod validation
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  useEffect(() => {
    if (searchParams.has('success')) {
      setMessage({ success: searchParams.get('success')! });
    } else if (searchParams.has('error')) {
      setMessage({ error: searchParams.get('error')! });
    } else if (searchParams.has('message')) {
      setMessage({ message: searchParams.get('message')! });
    }
  }, [searchParams]);

  const onSubmit = async (values: SignInFormValues) => {    
    setIsLoading(true);
    setMessage(null);
    
    try {
      // Hash the password for authentication with backend
      const authHash = hashPasswordForAuth(values.password);
      
      // Hash the password for encryption and store it in a cookie for client-side encryption
      const encryptionKey = hashPasswordForEncryption(values.password);
      storeEncryptionKey(encryptionKey);
      
      // Create and submit the form data with the hashed password for authentication
      const formData = new FormData();
      formData.append('email', values.email);
      formData.append('password', authHash);
      
      const result = await signInClient(formData);
      
      if (result.error) {
        setMessage({ error: result.error });
      } else if (result.success) {
        // Small delay to allow auth state to propagate
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      }
    } catch (error) {
      setMessage({ error: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const ssoEnabled = isSSOEnabled();

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)} 
        className="flex-1 flex flex-col min-w-64"
        autoComplete="on"
      >
        <h1 className="text-2xl font-medium">Sign in</h1>
        <p className="text-sm text-foreground">
          Don't have an account?{" "}
          <Link className="text-foreground font-medium underline" href="/sign-up">
            Sign up
          </Link>
        </p>
        
        {ssoEnabled && (
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={redirectToSSOLogin}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Sign in with Streamline Account
            </Button>
            
            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>
        )}
        
        <div className={`flex flex-col gap-4 ${ssoEnabled ? '' : 'mt-8'}`}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="email">Email</FormLabel>
                <FormControl>
                  <Input 
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel htmlFor="current-password">Password</FormLabel>
                  <Link
                    className="text-xs text-foreground underline"
                    href="/forgot-password"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <FormControl>
                  <Input 
                    id="current-password"
                    type="password" 
                    autoComplete="current-password"
                    placeholder="Your password" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <SubmitButton pendingText="Signing In..." disabled={isLoading}>
            {isLoading ? "Signing In..." : "Sign in"}
          </SubmitButton>
          { message ? <AuthFormMessage message={message} /> : null }
        </div>
      </form>
    </Form>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
