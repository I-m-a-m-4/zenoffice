'use client';

import React from 'react';

interface Admin2FAGateProps {
  children: React.ReactNode;
}

export default function Admin2FAGate({ children }: Admin2FAGateProps) {
  // 2FA has been disabled per user request
  return <>{children}</>;
}
