// reCAPTCHA v3 client hook.
//
// Production: set VITE_RECAPTCHA_SITE_KEY (client env). The script is loaded
// on demand and an invisible token is minted before signup.
// Demo mode: no site key → returns null; the server accepts in demo mode.

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoading = null;
      reject(new Error("Failed to load reCAPTCHA"));
    };
    document.head.appendChild(s);
  });
  return scriptLoading;
}

// Mints an invisible reCAPTCHA v3 token, or returns null in demo mode.
export async function getCaptchaToken(
  action = "signup",
): Promise<string | null> {
  if (!SITE_KEY) return null; // demo mode — server accepts
  try {
    await loadScript();
    await new Promise<void>((resolve) => {
      if (window.grecaptcha?.ready) window.grecaptcha.ready(resolve);
      else setTimeout(resolve, 1000);
    });
    const token = await window.grecaptcha!.execute(SITE_KEY, { action });
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export const captchaConfigured = Boolean(SITE_KEY);
