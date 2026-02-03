import { useEffect, useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { getFirestoreDb } from '~/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Facebook SDK type definitions
declare global {
  interface Window {
    FB: {
      init: (params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: FacebookAuthResponse) => void,
        options?: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          scope?: string;
          extras?: Record<string, unknown>;
        }
      ) => void;
    };
    fbAsyncInit: () => void;
  }
}

interface FacebookSignupButtonProps {
  configId: string;
}

type SignupState = 'idle' | 'loading' | 'success' | 'error';

interface FacebookAuthResponse {
  authResponse?: {
    code: string;
    userID?: string;
  };
  status?: string;
}

const FacebookSignupButton: FunctionalComponent<FacebookSignupButtonProps> = ({ configId }) => {
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [signupState, setSignupState] = useState<SignupState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Check if FB SDK is already loaded
    if (typeof window.FB !== 'undefined') {
      setIsSdkReady(true);
      return;
    }

    // Listen for SDK ready event
    const handleSdkReady = () => setIsSdkReady(true);
    window.addEventListener('facebook-sdk-ready', handleSdkReady);

    return () => {
      window.removeEventListener('facebook-sdk-ready', handleSdkReady);
    };
  }, []);

  const saveAuthCodeToFirestore = async (authCode: string, userId?: string) => {
    try {
      const db = getFirestoreDb();
      if (!db) {
        throw new Error('Firestore is not configured');
      }

      const authCollection = collection(db, 'facebook_auth');
      await addDoc(authCollection, {
        authCode,
        userId: userId || null,
        timestamp: serverTimestamp(),
        status: 'pending',
        scope: 'whatsapp_business_management,whatsapp_business_messaging',
      });

      console.log('Auth code saved to Firestore successfully');
      return true;
    } catch (error) {
      console.error('Error saving auth code to Firestore:', error);
      throw error;
    }
  };

  const handleClick = () => {
    if (!isSdkReady || typeof window.FB === 'undefined') {
      setErrorMessage('Facebook SDK not loaded. Please refresh the page.');
      setSignupState('error');
      return;
    }

    setSignupState('loading');
    setErrorMessage('');

    window.FB.login(
      (response: FacebookAuthResponse) => {
        if (response.authResponse && response.authResponse.code) {
          // Handle async Firestore operation separately
          saveAuthCodeToFirestore(response.authResponse.code, response.authResponse.userID)
            .then(() => {
              setSignupState('success');
            })
            .catch((error) => {
              console.error('Failed to save auth code:', error);
              setErrorMessage('Failed to save authentication. Please try again.');
              setSignupState('error');
            });
        } else {
          console.log('User cancelled login or did not fully authorize.');
          setErrorMessage('Authorization was cancelled or incomplete.');
          setSignupState('error');
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        // WhatsApp permissions - others are granted through Embedded Signup config
        scope: 'whatsapp_business_management,whatsapp_business_messaging',
        extras: {
          feature: 'whatsapp_embedded_signup',
        },
      }
    );
  };

  const handleRetry = () => {
    setSignupState('idle');
    setErrorMessage('');
  };

  if (signupState === 'success') {
    return (
      <div class="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
        <svg
          class="w-16 h-16 mx-auto mb-4 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <h3 class="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">Connection Successful!</h3>
        <p class="text-green-800 dark:text-green-200 mb-4">
          Your Facebook Business account has been connected successfully. Our team will review and activate your
          integration shortly.
        </p>
        <a
          href="/"
          class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
        >
          Return to Homepage
        </a>
      </div>
    );
  }

  if (signupState === 'error') {
    return (
      <div class="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
        <svg
          class="w-16 h-16 mx-auto mb-4 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 class="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">Connection Failed</h3>
        <p class="text-red-800 dark:text-red-200 mb-4">{errorMessage || 'An unexpected error occurred.'}</p>
        <button
          onClick={handleRetry}
          class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!isSdkReady || signupState === 'loading'}
      class="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg"
    >
      {signupState === 'loading' && (
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {signupState === 'loading' ? 'Connecting...' : isSdkReady ? 'Connect with Facebook' : 'Loading...'}
    </button>
  );
};

export default FacebookSignupButton;
