import { SignUp, useSignUp } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function Register() {
  const { signUp } = useSignUp();
  const hasShownVerifyToastRef = useRef(false);

  // Show toast when email verification is needed
  useEffect(() => {
    // When status is 'missing_requirements' and email needs verification
    if (
      signUp?.status === 'missing_requirements' &&
      signUp?.unverifiedFields?.includes('email_address') &&
      !hasShownVerifyToastRef.current
    ) {
      hasShownVerifyToastRef.current = true;
      toast.info('Check your email', {
        description: 'Enter the verification code we sent to complete signup.',
        duration: 10000,
      });
    }
  }, [signUp?.status, signUp?.unverifiedFields]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[rgb(var(--color-bg-page))]">
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
          layout: {
            socialButtonsPlacement: 'bottom',
            socialButtonsVariant: 'iconButton',
          },
        }}
      />
      <p className="mt-4 text-xs text-[rgb(var(--color-text-tertiary))] text-center max-w-xs">
        By signing up, you agree to our{' '}
        <a href="https://showshowshow.app/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[rgb(var(--color-text-secondary))]">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="https://showshowshow.app/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-[rgb(var(--color-text-secondary))]">
          Privacy Policy
        </a>.
      </p>
      <p className="text-[rgb(var(--color-text-tertiary))] text-xs mt-3 text-center">
        Free for 7 days. $5/month after. No charge during trial.
      </p>
    </div>
  );
}
