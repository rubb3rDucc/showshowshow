import { SignUp } from '@clerk/clerk-react';

export function Register() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[rgb(var(--color-bg-page))]">
      <SignUp
        routing="path"
        path="/register"
        signInUrl="/login"
        afterSignUpUrl="/"
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-md',
          },
        }}
      />
    </div>
  );
}
