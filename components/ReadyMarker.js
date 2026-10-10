'use client';
import { useEffect } from 'react';

// Marks the page as interactive once React has hydrated, for browser tests and tooling.
export default function ReadyMarker() {
  useEffect(() => {
    document.body.setAttribute('data-ready', 'true');
  }, []);
  return null;
}
