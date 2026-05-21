'use client';

import { useState } from 'react';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';

type View = 'signin' | 'signup' | 'forgot';

export function AuthCard({ initial = 'signin' }: { initial?: View }) {
  const [view, setView] = useState<View>(initial);

  return (
    <div className="w-full max-w-md rounded-[20px] border border-cream/15 bg-ink-elev/70 p-7 shadow-playly-md">
      {/* Tab switcher — hidden in forgot view (forgot is a sub-flow off signin) */}
      {view !== 'forgot' ? (
        <div className="mb-5 grid grid-cols-2 rounded-md bg-ink/40 p-1">
          <TabBtn active={view === 'signin'} onClick={() => setView('signin')}>
            Sign In
          </TabBtn>
          <TabBtn active={view === 'signup'} onClick={() => setView('signup')}>
            Sign Up
          </TabBtn>
        </div>
      ) : null}

      {view === 'signin' ? (
        <SignInForm onForgotPassword={() => setView('forgot')} />
      ) : view === 'signup' ? (
        <SignUpForm />
      ) : (
        <ForgotPasswordForm onBack={() => setView('signin')} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[5px] px-3 py-2 text-xs font-bold transition-colors ${
        active
          ? 'bg-wine text-cream shadow-playly-sm'
          : 'text-cream-soft hover:text-cream'
      }`}
    >
      {children}
    </button>
  );
}
