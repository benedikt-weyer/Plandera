'use client';

import { signUpClient } from "@/utils/auth/auth-client";
import { FormMessage as AuthFormMessage, Message } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { hashPasswordForAuth } from "@/utils/cryptography/encryption";

// Define the schema for form validation
const signUpSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(1, { message: "Please confirm your password" })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

function SignUpForm() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<Message | null>(null);

  // Initialize react-hook-form with zod validation
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
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

  const onSubmit = async (values: SignUpFormValues) => {
    // Hash the password for authentication with backend
    const authHash = hashPasswordForAuth(values.password);
    
    const formData = new FormData();
    formData.append('email', values.email);
    formData.append('password', authHash);
    
    const result = await signUpClient(formData);
    
    if (result.error) {
      setMessage({ error: result.error });
    } else if (result.success) {
      setMessage({ success: result.success });
    }
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)} 
        className="flex flex-col min-w-64 max-w-64 mx-auto"
        autoComplete="on"
      >
        <h1 className="text-2xl font-medium">Sign up</h1>
        <p className="text-sm text text-foreground">
          Already have an account?{" "}
          <Link className="text-primary font-medium underline" href="/sign-in">
            Sign in
          </Link>
        </p>
        <div className="flex flex-col gap-4 mt-8">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="signup-email">Email</FormLabel>
                <FormControl>
                  <Input 
                    id="signup-email"
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
                <FormLabel htmlFor="new-password">Password</FormLabel>
                <FormControl>
                  <Input 
                    id="new-password"
                    type="password" 
                    autoComplete="new-password"
                    placeholder="Your password" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="confirm-password">Confirm Password</FormLabel>
                <FormControl>
                  <Input 
                    id="confirm-password"
                    type="password" 
                    autoComplete="new-password"
                    placeholder="Confirm your password" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <SubmitButton pendingText="Signing up...">
            Sign up
          </SubmitButton>
          {message && <AuthFormMessage message={message} />}
        </div>
      </form>
    </Form>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpForm />
    </Suspense>
  );
}
