import { useAuth, useClerk } from '@clerk/clerk-react';

export function ClerkTest() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const clerk = useClerk();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Clerk Debug Info</h1>

      <div className="space-y-2">
        <p><strong>Clerk Loaded:</strong> {isLoaded ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Is Signed In:</strong> {isSignedIn ? '✅ Yes' : '❌ No'}</p>
        <p><strong>User ID:</strong> {userId || 'None'}</p>
        <p><strong>Clerk Instance:</strong> {clerk ? '✅ Exists' : '❌ Missing'}</p>
        <p><strong>Publishable Key (first 20 chars):</strong> {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 20) || 'Missing'}</p>
        <p><strong>Key Length:</strong> {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.length || 0} characters</p>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Test Actions</h2>
        <button
          onClick={() => clerk.openSignIn()}
          className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
        >
          Open Sign In Modal
        </button>
        <button
          onClick={() => clerk.openSignUp()}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Open Sign Up Modal
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Environment Check:</h3>
        <pre className="text-xs">
          {JSON.stringify({
            hasClerkKey: !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
            keyPrefix: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 7),
            apiUrl: import.meta.env.VITE_API_URL,
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
