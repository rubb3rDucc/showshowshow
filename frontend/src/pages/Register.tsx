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
          layout: {
            socialButtonsPlacement: 'bottom',
            socialButtonsVariant: 'iconButton',
          },
        }}
      />
    </div>
  );
}
