import { SignIn } from '@clerk/clerk-react';

export function Login() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[rgb(var(--color-bg-page))]">
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/register"
        afterSignInUrl="/"
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-md',
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
            footerActionLink: 'text-blue-600 hover:text-blue-700',
          },
        }}
      />
    </div>
  );
}
