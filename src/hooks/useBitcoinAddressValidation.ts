import { useEffect, useState } from 'react';

type AddressValidation = typeof import('@/lib/bitcoinAddress');

/** Load validation only while an address form is mounted; callers wait before accepting an address. */
export function useBitcoinAddressValidation() {
  const [validation, setValidation] = useState<AddressValidation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void import('@/lib/bitcoinAddress').then(
      (module) => { if (active) setValidation(module); },
      () => { if (active) setError("Address validation couldn't load. Reload the page to try again."); },
    );
    return () => { active = false; };
  }, []);

  return { validation, error };
}
