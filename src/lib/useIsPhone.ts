import { useEffect, useState } from 'react';

/** Phone layout at 860px wide or narrower (an upright iPad gets the phone layout). */
export const PHONE_QUERY = '(max-width: 860px)';

export function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches;
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}
