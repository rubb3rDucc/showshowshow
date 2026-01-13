import { SignIn } from '@clerk/clerk-react';

export function Login() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[rgb(var(--color-bg-page))] px-4">
      <div className="text-center mb-8 max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-[rgb(var(--color-text-primary))] mb-3">
          ShowShowShow
        </h1>
        <p className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
          Build a lineup of shows, then auto-generate a viewing schedule.
        </p>
        <p className="text-[rgb(var(--color-text-tertiary))] text-xs mt-2 italic">
          An early experiment in reducing decision fatigue.
        </p>
      </div>
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
      <p className="text-[rgb(var(--color-text-tertiary))] text-xs mt-6 text-center">
        By signing in, you agree to our{' '}
        <a href="https://showshowshow.app/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[rgb(var(--color-text-secondary))]">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="https://showshowshow.app/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-[rgb(var(--color-text-secondary))]">
          Privacy Policy
        </a>
      </p>
    </div>
  );
}
