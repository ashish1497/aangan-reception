'use client';
import { createContext, useCallback, useContext, useEffect, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const NavContext = createContext({ pending: false, setParams: () => {}, refresh: () => {} });

// Keeps dashboard state in the URL (?samples=1, ?count=1, ?call=<id>) so the server
// renders the right view on first paint, and exposes a pending flag for skeletons.
export default function NavProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // body[data-ready] is dropped while the server renders the next view and set again after.
  useEffect(() => {
    if (!pending) document.body.setAttribute('data-ready', 'true');
  }, [pending]);

  const busy = () => document.body.removeAttribute('data-ready');

  const setParams = useCallback(
    (changes) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === undefined) next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      busy();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  const refresh = useCallback(() => {
    busy();
    startTransition(() => router.refresh());
  }, [router]);

  return <NavContext.Provider value={{ pending, setParams, refresh }}>{children}</NavContext.Provider>;
}

export function useNav() {
  return useContext(NavContext);
}
