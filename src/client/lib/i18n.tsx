import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const LANGS = [
  { code: "en", label: "English", native: "English" },
  { code: "tw", label: "Twi", native: "Twi" },
  { code: "ga", label: "Ga", native: "Ga" },
  { code: "ee", label: "Ewe", native: "Eʋɛ" },
] as const;

export type LangCode = (typeof LANGS)[number]["code"];
type Dict = Record<string, string>;

const en: Dict = {
  home: "Home",
  community: "Community",
  blog: "Blog",
  projects: "Projects",
  events: "Events",
  civic: "Civic",
  economy: "Economy",
  about: "About",
  signin: "Sign in",
  join: "Join the Circle",
  joinfree: "Join free",
  welcome: "Welcome",
  explore: "Explore",
  impact: "See our impact",
  learnConst: "Learn the Constitution",
  allEvents: "All events",
  values: "Read our values",
  tagline: "One Circle. One Ghana.",
  footerNote:
    "Uniting Ghanaians under one Constitution, for a peaceful and prosperous Ghana.",
  joinTitle: "Join Adom Circle",
  joinSub: "One Circle. One Ghana.",
  submitProj: "Submit a project",
  pledge: "I intend to vote",
  learnMore: "Learn more",
};

const tw: Dict = {
  home: "Fie",
  community: "Kuw",
  blog: "Nsɛm",
  projects: "Adwumayɛ",
  events: "Nhyiamu",
  civic: "Ɔman Adwuma",
  economy: "Sikasɛm",
  about: "Yɛn Ho",
  signin: "Kɔ Mu",
  join: "Ka Kuw No Ho",
  joinfree: "Ka Ho Kwa",
  welcome: "Akwaaba",
  explore: "Hwehwɛ",
  impact: "Hwɛ Yɛn Nkɔsoɔ",
  learnConst: "Sua Ɔman Mmara",
  allEvents: "Nhyiamu Nyinaa",
  values: "Kenkan Yɛn Gyinapɛn",
  tagline: "Kuw Baako. Ghana Baako.",
  footerNote:
    "Yɛ ka Ghanafoɔ bom wɔ Ɔman Mmara baako ase, ama asomdwoeɛ ne nkɔsoɔ.",
  joinTitle: "Ka Adom Circle Ho",
  joinSub: "Kuw Baako. Ghana Baako.",
  submitProj: "Fa Adwumayɛ Kɔ Ma",
  pledge: "Mehyɛ bɔ sɛ mebɛto aba",
  learnMore: "Sua Bio",
};

const ga: Dict = {
  home: "Shia",
  community: "Asafo",
  blog: "Sanei",
  projects: "Nitsumɔi",
  events: "Hei",
  civic: "Maŋ Sane",
  economy: "Sika Sane",
  about: "Wɔ He",
  signin: "Kpe Omo",
  join: "Bua Adom Circle",
  joinfree: "Bua Kɛ Bawo",
  welcome: "Akweley",
  explore: "Kwɛ",
  impact: "Kwɛ Wɔ Nitsumɔ",
  learnConst: "Kase Maŋ Mmara",
  allEvents: "Hei Fɛɛ",
  values: "Kanemɔ Wɔ Gyinɛnii",
  tagline: "Asafo Kake. Maŋ Kake.",
  footerNote:
    "Wɔ kpeɔ Ghanabi kɛ bɔɔ mɔ kɛ Maŋ Mmara kake, shiwoo kɛ shishimɔ.",
  joinTitle: "Bua Adom Circle",
  joinSub: "Asafo Kake. Maŋ Kake.",
  submitProj: "Ŋma Nitsumɔ",
  pledge: "Miheɔ eko ni maba lo",
  learnMore: "Kase Wɔha",
};

const ee: Dict = {
  home: "Aƒe",
  community: "Habɔbɔ",
  blog: "Nyadzɔdzɔwo",
  projects: "Dɔwɔwɔwo",
  events: "Kpekpewo",
  civic: "Dukɔ",
  economy: "Ganyawo",
  about: "Mí Ƒe Tanya",
  signin: "Ge Ɖe Eme",
  join: "Wɔ Ha Adom Circle",
  joinfree: "Wɔ Ha Tagbaɖa",
  welcome: "Woezɔ",
  explore: "Kpɔ",
  impact: "Kpɔ Míaƒe Dɔwɔwɔwo",
  learnConst: "Srɔ̃ Dukoa Ƒe Se",
  allEvents: "Kpekpewo Katã",
  values: "Xlẽ Míaƒe Kpɔɖeŋuwo",
  tagline: "Habɔbɔ Ɖeka. Dukɔ Ɖeka.",
  footerNote:
    "Mí kplɔ Ghanatɔwo ƒo ƒu le Dukoa Ƒe Se ɖeka te, na ŋutifafa kple didiƒe.",
  joinTitle: "Wɔ Ha Adom Circle",
  joinSub: "Habɔbɔ Ɖeka. Dukɔ Ɖeka.",
  submitProj: "Ɖo Dɔwɔwɔ",
  pledge: "Meɖoe kple be maxɔ akɔɖi",
  learnMore: "Srɔ̃ Wu",
};

const DICTS: Record<LangCode, Dict> = { en, tw, ga, ee };

type I18nCtx = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    const saved = localStorage.getItem("adom_lang");
    return (saved as LangCode) || "en";
  });

  useEffect(() => {
    localStorage.setItem("adom_lang", lang);
  }, [lang]);

  const setLang = useCallback((l: LangCode) => setLangState(l), []);

  const t = useCallback(
    (key: string) => DICTS[lang][key] ?? en[key] ?? key,
    [lang],
  );

  return (
    <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
  );
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within LangProvider");
  return ctx;
}
