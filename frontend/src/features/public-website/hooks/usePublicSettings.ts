import { useState, useEffect } from 'react';
import { publicWebsiteApi, PublicCompanyInfo } from '../public-website.api';

let cachedSettings: PublicCompanyInfo | null = null;
let fetchPromise: Promise<PublicCompanyInfo> | null = null;

export function clearPublicSettingsCache() {
  cachedSettings = null;
  fetchPromise = null;
}

export function usePublicSettings() {
  const [settings, setSettings] = useState<PublicCompanyInfo | null>(cachedSettings);
  const [loading, setLoading] = useState<boolean>(!cachedSettings);

  useEffect(() => {
    let isMounted = true;

    if (cachedSettings) {
      setSettings(cachedSettings);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = publicWebsiteApi
        .getSettings()
        .then((data) => {
          cachedSettings = data;
          return data;
        })
        .catch((err) => {
          fetchPromise = null;
          throw err;
        });
    }

    fetchPromise
      .then((data) => {
        if (isMounted) {
          setSettings(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load public settings:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { settings, loading };
}
