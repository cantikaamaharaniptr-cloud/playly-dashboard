'use client';

import { useState } from 'react';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';

type Tab = 'signin' | 'signup';

export function AuthCard({ initial = 'signin' }: { initial?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <div className="w-full max-w-md rounded-[20px] border border-cream/15 bg-ink-elev/70 p-7 shadow-playly-md">
      {/* Tab switcher */}
      <div className="mb-5 grid grid-cols-2 rounded-md bg-ink/40 p-1">
        <TabBtn active={tab === 'signin'} onClick={() => setTab('signin')}>
          Sign In
        </TabBtn>
        <TabBtn active={tab === 'signup'} onClick={() => setTab('signup')}>
          Sign Up
        </TabBtn>
      </div>

      {tab === 'signin' ? <SignInForm /> : <SignUpForm />}
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
