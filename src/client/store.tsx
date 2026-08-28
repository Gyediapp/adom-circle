import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { rpcClient } from "./rpc-client";
import { getCaptchaToken } from "./lib/captcha";
import type { PublicMember } from "@/server/rpc/members";

const TOKEN_KEY = "adom_token";
const MEMBER_KEY = "adom_member_id"; // legacy fallback for old sessions

type Toast = { id: number; msg: string; kind: "success" | "error" };

type SignupInput = {
  name: string;
  email: string;
  phone?: string | null;
  region: string;
  hometown?: string;
  diasporaCountry?: string;
  church?: string;
  profession?: string;
  password: string;
  website?: string; // honeypot — must stay empty (bots fill it)
};

type StoreCtx = {
  user: PublicMember | null;
  loading: boolean;
  signup: (input: SignupInput) => Promise<{ member: PublicMember; devCode: string | null }>;
  login: (email: string, password: string) => Promise<PublicMember>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: PublicMember | null) => void;
  toasts: Toast[];
  toast: (msg: string, kind?: Toast["kind"]) => void;
  requireUser: () => PublicMember | null;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        const m = await rpcClient.members.me({ token });
        if (m) {
          setUser(m);
          setLoading(false);
          return;
        }
      } catch {
        // token invalid — fall through
      }
      localStorage.removeItem(TOKEN_KEY);
    }
    // Legacy fallback: old clients stored just the member id
    const id = localStorage.getItem(MEMBER_KEY);
    if (id) {
      try {
        const m = await rpcClient.members.byId(id);
        if (m) {
          setUser(m);
          setLoading(false);
          return;
        }
      } catch {
        // ignore
      }
    }
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signup = useCallback<StoreCtx["signup"]>(async (input) => {
    // reCAPTCHA v3: mint an invisible token (null in demo mode — server accepts)
    const captchaToken = await getCaptchaToken("signup");
    const res = await rpcClient.members.signup({
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
      region: input.region,
      hometown: input.hometown ?? "",
      diasporaCountry: input.diasporaCountry ?? "",
      church: input.church ?? "",
      profession: input.profession ?? "",
      password: input.password,
      website: input.website ?? "",
      captchaToken: captchaToken ?? undefined,
    });
    localStorage.setItem(MEMBER_KEY, res.member.id);
    setUser(res.member);
    return res;
  }, []);

  const login = useCallback<StoreCtx["login"]>(async (email, password) => {
    const { member, token } = await rpcClient.members.login({ email, password });
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(MEMBER_KEY, member.id);
    setUser(member);
    return member;
  }, []);

  const logout = useCallback<StoreCtx["logout"]>(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await rpcClient.members.logout({ token });
      } catch {
        // session already gone
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MEMBER_KEY);
    setUser(null);
  }, []);

  const requireUser = useCallback(() => user, [user]);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        signup,
        login,
        logout,
        refresh,
        setUser,
        toasts,
        toast,
        requireUser,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
