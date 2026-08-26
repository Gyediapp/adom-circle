import { randomUUID } from "crypto";
import { hashPassword, memberKV, type Member } from "./members";
import { DEFAULT_SETTINGS, postKV, settingsKV } from "./site";
import {
  messageKV,
  replyKV,
  reportKV,
  roomKV,
  threadKV,
} from "./community";
import { contributionKV, projectKV } from "./projects";
import { adKV, eventKV } from "./events";
import { notificationKV } from "./notifications";
import { emailKV } from "./emails";
import type { Room, Message, Thread, Reply, Report } from "./community";
import type { Project, Contribution } from "./projects";
import type { Post } from "./site";
import type { Event, Ad } from "./events";
import type { Notification } from "./notifications";
import type { OutboxEmail } from "./emails";

const now = (daysAgo = 0, hoursAgo = 0) =>
  new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString();

const future = (daysAhead: number) =>
  new Date(Date.now() + daysAhead * 86400000).toISOString();

// Demo password for every seeded account (change in production!)
const DEMO_PASSWORD = "Adom@2026";

// Seeded accounts are pre-verified (they're demo users)
type MemberSeed = Omit<
  Member,
  | "passwordHash"
  | "salt"
  | "emailVerified"
  | "verifyToken"
  | "verifyExpires"
  | "resetToken"
  | "resetExpires"
  | "following"
  | "followerCount"
  | "savedMessages"
  | "status"
>;

const members: MemberSeed[] = [
  {
    id: "admin-ama",
    name: "Ama Owusu",
    email: "admin@adomcircle.org",
    phone: "+233 20 000 0001",
    role: "admin",
    region: "greater-accra",
    hometown: "Accra",
    diasporaCountry: "",
    church: "",
    profession: "Community Strategist",
    bio: "Leading Adom Circle with love for Ghana and her people.",
    badges: ["Founder", "Community Organizer", "Voter"],
    pledgeVote: true,
    points: 2400,
    managedRooms: [],
    joinedAt: now(420),
  },
  {
    id: "m-kofi",
    name: "Kofi Mensah",
    email: "kofi@example.com",
    phone: "+233 24 111 2222",
    role: "moderator",
    region: "ashanti",
    hometown: "Kumasi",
    diasporaCountry: "",
    church: "Christ the King",
    profession: "Teacher",
    bio: "Youth mentor and volunteer hour tracker. Manages Youth & Education.",
    badges: ["Volunteer", "Mentor", "Voter"],
    pledgeVote: true,
    points: 950,
    managedRooms: ["room-youth"],
    joinedAt: now(300),
  },
  {
    id: "m-akua",
    name: "Akua Boateng",
    email: "akua@example.com",
    phone: "+233 26 333 4444",
    role: "member",
    region: "eastern",
    hometown: "Koforidua",
    diasporaCountry: "",
    church: "",
    profession: "Nurse",
    bio: "Health volunteer, passionate about rural clinics.",
    badges: ["Volunteer", "Project Sponsor"],
    pledgeVote: true,
    points: 700,
    managedRooms: [],
    joinedAt: now(210),
  },
  {
    id: "m-yaw",
    name: "Yaw Adjei",
    email: "yaw@example.com",
    phone: "+1 416 555 0101",
    role: "vip",
    region: "greater-accra",
    hometown: "Nsawam",
    diasporaCountry: "Canada",
    church: "St. George's",
    profession: "Software Engineer",
    bio: "Diaspora VIP member investing in Ghanaian startups.",
    badges: ["Investor", "Mentor", "Voter"],
    pledgeVote: true,
    points: 860,
    managedRooms: ["room-business"],
    joinedAt: now(180),
  },
  {
    id: "m-aba",
    name: "Aba Serwaa",
    email: "aba@example.com",
    phone: "+233 50 777 8888",
    role: "member",
    region: "central",
    hometown: "Cape Coast",
    diasporaCountry: "",
    church: "Methodist",
    profession: "Entrepreneur",
    bio: "Running a local food business in Cape Coast.",
    badges: ["Entrepreneur", "Voter"],
    pledgeVote: true,
    points: 420,
    managedRooms: [],
    joinedAt: now(150),
  },
  {
    id: "m-kwame",
    name: "Kwame Asante",
    email: "kwame@example.com",
    phone: "+44 20 7946 0000",
    role: "member",
    region: "bono",
    hometown: "Sunyani",
    diasporaCountry: "United Kingdom",
    church: "",
    profession: "Accountant",
    bio: "Supporting remittance literacy and family finance.",
    badges: ["Voter"],
    pledgeVote: false,
    points: 180,
    managedRooms: [],
    joinedAt: now(120),
  },
  {
    id: "m-efua",
    name: "Efua Nyarko",
    email: "efua@example.com",
    phone: "+233 27 999 0000",
    role: "member",
    region: "volta",
    hometown: "Ho",
    diasporaCountry: "",
    church: "",
    profession: "Farmer",
    bio: "Championing farm-to-school programmes.",
    badges: ["Volunteer"],
    pledgeVote: true,
    points: 300,
    managedRooms: [],
    joinedAt: now(90),
  },
  {
    id: "m-kojo",
    name: "Kojo Antwi",
    email: "kojo@example.com",
    phone: "+233 55 123 4567",
    role: "partner",
    region: "greater-accra",
    hometown: "Tema",
    diasporaCountry: "",
    church: "Presbyterian",
    profession: "Business Owner",
    bio: "Partner — supporting economic empowerment programmes.",
    badges: ["Partner", "Project Sponsor"],
    pledgeVote: true,
    points: 520,
    managedRooms: [],
    joinedAt: now(60),
  },
  {
    id: "m-nana",
    name: "Nana Adwoa",
    email: "nana@example.com",
    phone: "+1 646 555 0198",
    role: "member",
    region: "ashanti",
    hometown: "Mampong",
    diasporaCountry: "USA",
    church: "",
    profession: "Doctor",
    bio: "Telemedicine volunteer for rural communities.",
    badges: ["Mentor", "Voter"],
    pledgeVote: true,
    points: 610,
    managedRooms: [],
    joinedAt: now(45),
  },
  {
    id: "m-sena",
    name: "Sena Dogbe",
    email: "sena@example.com",
    phone: "+233 20 888 7777",
    role: "member",
    region: "northern",
    hometown: "Tamale",
    diasporaCountry: "",
    church: "",
    profession: "Student",
    bio: "Youth & education forum regular.",
    badges: ["New Member"],
    pledgeVote: false,
    points: 40,
    managedRooms: [],
    joinedAt: now(20),
  },
  {
    id: "m-adwoa",
    name: "Adwoa Sarpong",
    email: "adwoa@example.com",
    phone: "+233 24 555 6677",
    role: "moderator",
    region: "western",
    hometown: "Sekondi",
    diasporaCountry: "",
    church: "Anglican",
    profession: "Lawyer",
    bio: "Moderating with fairness and respect for all. Manages Civic & Voting.",
    badges: ["Community Organizer", "Voter"],
    pledgeVote: true,
    points: 880,
    managedRooms: ["room-civic"],
    joinedAt: now(100),
  },
  {
    id: "m-fifi",
    name: "Fifi Tetteh",
    email: "fifi@example.com",
    phone: "+233 30 222 3344",
    role: "member",
    region: "greater-accra",
    hometown: "Dodowa",
    diasporaCountry: "",
    church: "",
    profession: "Banker",
    bio: "Civic education volunteer.",
    badges: ["Volunteer", "Voter"],
    pledgeVote: true,
    points: 260,
    managedRooms: [],
    joinedAt: now(30),
  },
];

const rooms: Room[] = [
  { id: "room-general", name: "General", description: "Welcome, introductions and open conversation about Ghana.", icon: "🌍", color: "#CE1126", pinned: true, createdAt: now(400) },
  { id: "room-youth", name: "Youth & Education", description: "Mentorship, scholarships, schools and the next generation.", icon: "🎓", color: "#FCD116", pinned: true, createdAt: now(395) },
  { id: "room-health", name: "Health & Welfare", description: "Clinics, clean water, nutrition and community care.", icon: "🩺", color: "#006B3F", pinned: true, createdAt: now(390) },
  { id: "room-business", name: "Business & Economy", description: "Entrepreneurship, investment and buying Ghanaian.", icon: "📈", color: "#0E7490", pinned: true, createdAt: now(385) },
  { id: "room-civic", name: "Civic & Voting", description: "The Constitution, registration and peaceful elections.", icon: "🗳️", color: "#7C3AED", pinned: true, createdAt: now(380) },
  { id: "room-diaspora", name: "Diaspora Corner", description: "Ghanaians abroad — remittances, returns and connections.", icon: "✈️", color: "#B45309", pinned: false, createdAt: now(375) },
  { id: "room-values", name: "Faith & Values", description: "Faith, family and the values that keep Ghana peaceful.", icon: "🕊️", color: "#DB2777", pinned: false, createdAt: now(370) },
  { id: "room-projects", name: "Projects & Volunteering", description: "Coordinate volunteer hours, resources and project teams.", icon: "🤝", color: "#15803D", pinned: false, createdAt: now(365) },
];

const messages: Array<Omit<Message, "replyToId" | "reactions" | "savedBy" | "editedAt" | "deleted" | "mentions" | "audio">> = [
  { id: randomUUID(), roomId: "room-general", authorId: "admin-ama", authorName: "Ama Owusu", authorRegion: "greater-accra", text: "Medase for joining Adom Circle! Introduce yourself — tell us where you're from and what you love about Ghana. 🇬🇭", createdAt: now(10, 5) },
  { id: randomUUID(), roomId: "room-general", authorId: "m-kofi", authorName: "Kofi Mensah", authorRegion: "ashanti", text: "Kumasi here! Teacher by profession, youth mentor by calling. Happy to connect anyone with volunteering opportunities in Ashanti.", createdAt: now(10, 3) },
  { id: randomUUID(), roomId: "room-general", authorId: "m-yaw", authorName: "Yaw Adjei", authorRegion: "greater-accra", text: "From Toronto but Nsawam at heart. Looking to mentor young developers back home — the talent is unreal.", createdAt: now(9, 20) },
  { id: randomUUID(), roomId: "room-general", authorId: "m-aba", authorName: "Aba Serwaa", authorRegion: "central", text: "Cape Coast! My small business supports local farmers. If you're diaspora and want to support local products, let's talk.", createdAt: now(9, 2) },
  { id: randomUUID(), roomId: "room-civic", authorId: "m-adwoa", authorName: "Adwoa Sarpong", authorRegion: "western", text: "Reminder: check your voter registration status. Peace starts with participation.", createdAt: now(8, 10) },
  { id: randomUUID(), roomId: "room-civic", authorId: "m-fifi", authorName: "Fifi Tetteh", authorRegion: "greater-accra", text: "The Constitution of Ghana is above every institution. That's the foundation of our peace — let's teach it everywhere.", createdAt: now(8, 1) },
  { id: randomUUID(), roomId: "room-youth", authorId: "m-nana", authorName: "Nana Adwoa", authorRegion: "ashanti", text: "Offering free Saturday STEM mentorship online for JHS students. DM me to join the roster.", createdAt: now(7, 12) },
  { id: randomUUID(), roomId: "room-business", authorId: "m-kojo", authorName: "Kojo Antwi", authorRegion: "greater-accra", text: "Diaspora members: there are great treasury bill options and SME funds. Let's invest responsibly in Ghana.", createdAt: now(6, 8) },
  { id: randomUUID(), roomId: "room-diaspora", authorId: "m-kwame", authorName: "Kwame Asante", authorRegion: "bono", text: "From London — happy to guide anyone on sending remittances with the lowest fees.", createdAt: now(5, 6) },
  { id: randomUUID(), roomId: "room-health", authorId: "m-akua", authorName: "Akua Boateng", authorRegion: "eastern", text: "Health screening outreach in Koforidua this weekend — volunteers needed! Blood pressure, sugar and education.", createdAt: now(4, 3) },
  { id: randomUUID(), roomId: "room-projects", authorId: "m-efua", authorName: "Efua Nyarko", authorRegion: "volta", text: "Farm-to-school in Ho is going well — three schools now source vegetables from local women farmers.", createdAt: now(3, 5) },
  { id: randomUUID(), roomId: "room-values", authorId: "m-sena", authorName: "Sena Dogbe", authorRegion: "northern", text: "Peace is a gift we must protect. Faith and respect for one another go hand in hand.", createdAt: now(2, 2) },
];

const threads: Array<Omit<Thread, "editedAt">> = [
  {
    id: randomUUID(), roomId: "room-civic", title: "Why the Constitution must stay above every institution",
    body: "Our peace and stability rest on one simple idea: the Constitution of Ghana is supreme. No denomination, institution or group stands above it. Let's discuss how we teach this in our churches, mosques, families and communities — with respect for everyone's faith.",
    authorId: "admin-ama", authorName: "Ama Owusu", likes: 42, likedBy: ["m-kofi", "m-adwoa", "m-fifi", "m-akua", "m-yaw"], createdAt: now(12),
  },
  {
    id: randomUUID(), roomId: "room-business", title: "Investing back home: what actually works",
    body: "Diaspora members: treasury bills, mutual funds, SME equity, real estate — what has worked for you? What pitfalls should we warn others about? Let's build a practical guide as a community.",
    authorId: "m-yaw", authorName: "Yaw Adjei", likes: 27, likedBy: ["m-kwame", "m-kojo", "m-aba"], createdAt: now(9),
  },
  {
    id: randomUUID(), roomId: "room-youth", title: "Volunteer hours: let's track our real impact",
    body: "Proposal: every volunteer logs their hours here. Imagine showing Ghana — and the world — that we contributed 100,000+ hours in a year. Schools, clinics, clean-ups, mentoring. Let's count it.",
    authorId: "m-kofi", authorName: "Kofi Mensah", likes: 35, likedBy: ["admin-ama", "m-akua", "m-nana", "m-efua"], createdAt: now(7),
  },
  {
    id: randomUUID(), roomId: "room-diaspora", title: "How I sent remittances to build my hometown school",
    body: "A few friends and I pooled remittances to renovate a classroom block in Nsawam. Lessons learned: work with the local chief and PTA, agree on transparent accounting, and celebrate publicly. Happy to share a template.",
    authorId: "m-yaw", authorName: "Yaw Adjei", likes: 31, likedBy: ["m-kwame", "m-nana", "admin-ama"], createdAt: now(5),
  },
  {
    id: randomUUID(), roomId: "room-health", title: "Rural clinic support: what communities actually need",
    body: "After volunteering in three districts, the biggest gaps are: blood pressure machines, infant weighing scales, and basic training. Money alone isn't the answer — coordination is. Who wants to form a health task force?",
    authorId: "m-akua", authorName: "Akua Boateng", likes: 18, likedBy: ["m-efua", "m-nana"], createdAt: now(4),
  },
  {
    id: randomUUID(), roomId: "room-values", title: "Faith and civic duty: staying engaged without division",
    body: "We can love our faith deeply and still respect every Ghanaian's freedom of worship. That balance is what keeps us peaceful. Share how your community stays engaged in civic life with grace.",
    authorId: "m-adwoa", authorName: "Adwoa Sarpong", likes: 24, likedBy: ["m-sena", "m-kofi", "admin-ama"], createdAt: now(3),
  },
  {
    id: randomUUID(), roomId: "room-general", title: "Welcome! Tell us your Ghana story",
    body: "New here? Introduce yourself: your region, your hometown, and one thing you love about Ghana. This is your circle. 🌍",
    authorId: "admin-ama", authorName: "Ama Owusu", likes: 51, likedBy: ["m-kofi", "m-akua", "m-yaw", "m-aba", "m-sena"], createdAt: now(15),
  },
];

const replies: Array<Omit<Reply, "editedAt" | "deleted">> = [
  { id: randomUUID(), threadId: threads[0].id, authorId: "m-fifi", authorName: "Fifi Tetteh", text: "We should create simple posters explaining the supremacy clause and share them in every community. Education is everything.", createdAt: now(11, 20) },
  { id: randomUUID(), threadId: threads[0].id, authorId: "m-kofi", authorName: "Kofi Mensah", text: "Agreed. I've started a monthly civic class at my church in Kumasi — open to all faiths, focused on the Constitution.", createdAt: now(11, 2) },
  { id: randomUUID(), threadId: threads[2].id, authorId: "m-akua", authorName: "Akua Boateng", text: "Count me in! Logging my clinic hours weekly. 14 hours this month so far.", createdAt: now(6, 10) },
  { id: randomUUID(), threadId: threads[2].id, authorId: "m-nana", authorName: "Nana Adwoa", text: "Mentorship hours count too — 6 hours of STEM classes logged.", createdAt: now(6, 1) },
  { id: randomUUID(), threadId: threads[3].id, authorId: "m-kwame", authorName: "Kwame Asante", text: "This is gold. The transparent accounting part is what keeps donors trusting. Please share the template!", createdAt: now(4, 12) },
  { id: randomUUID(), threadId: threads[4].id, authorId: "m-efua", authorName: "Efua Nyarko", text: "Volta here — we need weighing scales in three CHPS compounds. Happy to coordinate logistics.", createdAt: now(3, 15) },
];

const reports: Report[] = [
  { id: randomUUID(), targetType: "thread", targetLabel: "Spam post in General", reason: "Looks like spam/scam link", reporter: "Kofi Mensah", status: "open", createdAt: now(1, 8) },
  { id: randomUUID(), targetType: "message", targetLabel: "Message in Business & Economy", reason: "Possible misinformation about an investment scheme", reporter: "Yaw Adjei", status: "open", createdAt: now(0, 20) },
];

const projects: Project[] = [
  { id: "proj-water", title: "Clean Water for Ahafo Villages", description: "Borehole drilling and maintenance training for six communities in Ahafo, bringing safe water to over 8,000 people.", location: "Goaso", region: "ahafo", theme: "Health", status: "ongoing", volunteers: 24, hours: 860, sponsor: "Adom Circle + Ghana Water Aid", image: "/output/images/projects.jpg", submittedBy: "Akua Boateng", createdAt: now(200), milestones: ["Survey complete", "3 of 6 boreholes drilled"] },
  { id: "proj-stem", title: "Girls in STEM — Tamale", description: "Weekend coding and science clubs for 200 JHS girls in Northern Region, with mentorship from diaspora engineers.", location: "Tamale", region: "northern", theme: "Education", status: "ongoing", volunteers: 31, hours: 1240, sponsor: "Diaspora Engineers Guild", image: "/output/images/education.jpg", submittedBy: "Nana Adwoa", createdAt: now(180), milestones: ["12 clubs launched", "80 laptops donated"] },
  { id: "proj-skills", title: "Cape Coast Youth Skills Hub", description: "Hands-on training in tailoring, carpentry and digital skills for 150 youth, connected to local apprenticeships.", location: "Cape Coast", region: "central", theme: "Youth", status: "ongoing", volunteers: 18, hours: 640, sponsor: "Local business coalition", image: "/output/images/economy.jpg", submittedBy: "Aba Serwaa", createdAt: now(150), milestones: ["Workshop space secured", "First cohort enrolled"] },
  { id: "proj-farm", title: "Farm-to-School: Northern Savanna", description: "Connecting women farmers with school feeding programmes — fresh vegetables in classrooms, stable income for farmers.", location: "Damongo", region: "savannah", theme: "Economic", status: "ongoing", volunteers: 15, hours: 520, sponsor: "Efua's Farm Co-op", image: "/output/images/hero.jpg", submittedBy: "Efua Nyarko", createdAt: now(120), milestones: ["3 schools onboarded", "12 farmers contracted"] },
  { id: "proj-digital", title: "Digital Literacy for Rural Teachers", description: "Training 300 teachers across Bono East in digital tools, lesson planning and safe internet use.", location: "Techiman", region: "bono-east", theme: "Education", status: "planned", volunteers: 0, hours: 0, sponsor: "Proposed by Yaw Adjei", image: "/output/images/education.jpg", submittedBy: "Yaw Adjei", createdAt: now(30), milestones: [] },
  { id: "proj-clinic", title: "Community Clinic Support — Ho", description: "Equipment, training and outreach support for CHPS compounds in Volta Region.", location: "Ho", region: "volta", theme: "Health", status: "completed", volunteers: 42, hours: 1890, sponsor: "Health task force", image: "/output/images/projects.jpg", submittedBy: "Akua Boateng", createdAt: now(400), milestones: ["Weighing scales delivered", "Training complete"] },
  { id: "proj-cleanup", title: "Beach Cleanup & Ocean Economy — Sekondi", description: "Coastal clean-ups paired with training in sustainable fishing and eco-tourism for youth.", location: "Sekondi", region: "western", theme: "Environment", status: "completed", volunteers: 76, hours: 2210, sponsor: "Western region chapters", image: "/output/images/economy.jpg", submittedBy: "Adwoa Sarpong", createdAt: now(350), milestones: ["8 clean-ups", "40 youth trained"] },
  { id: "proj-voter", title: "Voter Education Roadshow", description: "Non-partisan civic education tour across 16 regions — registration drives, the Constitution, and why participation matters.", location: "Nationwide", region: "greater-accra", theme: "Civic", status: "ongoing", volunteers: 58, hours: 2350, sponsor: "Adom Circle civic wing", image: "/output/images/civic.jpg", submittedBy: "Ama Owusu", createdAt: now(100), milestones: ["8 regions covered", "4,100 citizens reached"] },
];

const contributions: Contribution[] = [
  { id: randomUUID(), projectId: "proj-water", memberId: "m-akua", memberName: "Akua Boateng", type: "Time", note: "Community health talks at drilling sites", hours: 14, createdAt: now(20) },
  { id: randomUUID(), projectId: "proj-stem", memberId: "m-yaw", memberName: "Yaw Adjei", type: "Skills", note: "Curriculum design and online mentoring", hours: 6, createdAt: now(18) },
  { id: randomUUID(), projectId: "proj-voter", memberId: "m-fifi", memberName: "Fifi Tetteh", type: "Time", note: "Registration drive at local market", hours: 8, createdAt: now(15) },
  { id: randomUUID(), projectId: "proj-farm", memberId: "m-kojo", memberName: "Kojo Antwi", type: "Resources", note: "Storage crates for vegetable transport", hours: 0, createdAt: now(10) },
  { id: randomUUID(), projectId: "proj-skills", memberId: "m-aba", memberName: "Aba Serwaa", type: "Time", note: "Business skills workshop for cohort", hours: 5, createdAt: now(6) },
];

const events: Event[] = [
  {
    id: "evt-webinar", title: "Diaspora Investment Webinar", description: "A practical session on treasury bills, SME funds and diaspora bonds — how to invest back home responsibly, with Q&A.", date: future(8), time: "18:00 GMT", location: "Online (Zoom)", region: "greater-accra", mode: "virtual", category: "Workshop", organizer: "Yaw Adjei", image: "/output/images/economy.jpg", featured: true, attendees: ["m-yaw", "m-kwame", "m-nana", "m-kojo"], attendeeCount: 4, createdAt: now(14),
  },
  {
    id: "evt-registration", title: "Voter Registration Drive — Kumasi", description: "Non-partisan help desk: check your registration status, fix errors, and learn how the EC works. All faiths and parties welcome.", date: future(12), time: "09:00 – 15:00", location: "Kejetia Hub", region: "ashanti", mode: "physical", category: "Civic", organizer: "Adwoa Sarpong", image: "/output/images/civic.jpg", featured: true, attendees: ["m-kofi", "m-adwoa", "m-fifi", "admin-ama", "m-aba"], attendeeCount: 5, createdAt: now(10),
  },
  {
    id: "evt-farmday", title: "Farm-to-School Volunteer Day", description: "Join women farmers in Damongo packing and delivering fresh vegetables to three schools. Lunch provided!", date: future(20), time: "07:00 – 13:00", location: "Damongo", region: "savannah", mode: "physical", category: "Volunteer", organizer: "Efua Nyarko", image: "/output/images/hero.jpg", featured: false, attendees: ["m-efua", "m-akua"], attendeeCount: 2, createdAt: now(8),
  },
  {
    id: "evt-health", title: "Health Screening Outreach — Koforidua", description: "Free blood pressure, sugar checks and health education at the community centre. Volunteers needed for registration and counselling.", date: future(5), time: "08:00 – 14:00", location: "Koforidua Community Centre", region: "eastern", mode: "physical", category: "Social", organizer: "Akua Boateng", image: "/output/images/projects.jpg", featured: true, attendees: ["m-akua", "m-nana", "m-efua", "m-fifi"], attendeeCount: 4, createdAt: now(6),
  },
  {
    id: "evt-stemfest", title: "Youth STEM Fest — Tamale", description: "Coding challenges, science demos and mentorship for 200 JHS girls. A celebration of the Girls in STEM project's first year.", date: now(15), time: "10:00 – 16:00", location: "Tamale Sports Stadium", region: "northern", mode: "physical", category: "Meetup", organizer: "Nana Adwoa", image: "/output/images/education.jpg", featured: false, attendees: ["m-nana", "m-yaw", "m-kofi", "m-sena", "admin-ama", "m-akua"], attendeeCount: 6, createdAt: now(30),
  },
  {
    id: "evt-beach", title: "Beach Cleanup & Ocean Economy Day", description: "Coastal clean-up in Sekondi followed by a workshop on sustainable fishing and eco-tourism opportunities for youth.", date: now(10), time: "06:30 – 12:00", location: "Sekondi Beach", region: "western", mode: "physical", category: "Volunteer", organizer: "Adwoa Sarpong", image: "/output/images/economy.jpg", featured: false, attendees: ["m-adwoa", "m-kojo", "m-aba", "m-fifi"], attendeeCount: 4, createdAt: now(25),
  },
];

const ads: Ad[] = [
  {
    id: "ad-sme", title: "Invest in Ghana's SME Fund", tagline: "Vetted small businesses seeking responsible diaspora investment — from as little as GH₵500.", image: "/output/images/economy.jpg", link: "#", sponsor: "Ghana Enterprises Agency partner", placement: "both", active: true, clicks: 214, createdAt: now(20),
  },
  {
    id: "ad-roadshow", title: "Support the Voter Education Roadshow", tagline: "Help us reach all 16 regions with non-partisan civic education. Sponsor a stop or volunteer.", image: "/output/images/civic.jpg", link: "#", sponsor: "Adom Circle civic wing", placement: "events", active: true, clicks: 97, createdAt: now(15),
  },
  {
    id: "ad-bakery", title: "Golden Sun Bakery — Accra", tagline: "100% Ghanaian flour, family-run since 1998. Buy Ghanaian, build Ghana.", image: "/output/images/community.jpg", link: "#", sponsor: "Member business", placement: "home", active: true, clicks: 342, createdAt: now(12),
  },
  {
    id: "ad-apparel", title: "Kente & Co. — Diaspora shipping", tagline: "Authentic kente to your door anywhere in the world. Supporting 40 weavers in Bonwire.", image: "/output/images/hero.jpg", link: "#", sponsor: "Member business", placement: "home", active: false, clicks: 51, createdAt: now(9),
  },
];

const posts: Post[] = [  {
    id: randomUUID(), title: "Adom Circle turns 1 — 12,000 members and counting",
    body: "In one year, our circle has grown from a WhatsApp channel to a movement across all 16 regions and 14 countries. Together we logged over 52,000 volunteer hours, sponsored 86 projects, and kept the conversation about peace, values and prosperity alive. This is only the beginning.",
    category: "News", author: "Ama Owusu", image: "/output/images/community.jpg", featured: true, createdAt: now(6),
  },
  {
    id: randomUUID(), title: "The Black Star still shines: why civic duty is a Christian calling",
    body: "Peace and majority stability are not guaranteed forever. Staying engaged — registering, voting, and praying for leaders — is how we protect what God has given Ghana. Adom Circle is non-partisan, but never passive.",
    category: "Values", author: "Ama Owusu", image: "/output/images/civic.jpg", featured: true, createdAt: now(4),
  },
  {
    id: randomUUID(), title: "5 ways diaspora Ghanaians can invest back home responsibly",
    body: "From treasury bills to SME funds to farmland partnerships — learn the practical first steps, the questions to ask, and the pitfalls to avoid, compiled by our Business & Economy circle.",
    category: "Economy", author: "Yaw Adjei", image: "/output/images/economy.jpg", featured: false, createdAt: now(3),
  },
  {
    id: randomUUID(), title: "Farm-to-school: fresh hope in the Savanna",
    body: "Twelve women farmers now supply three schools with fresh vegetables. Children eat better, farmers earn steadily, and a whole community sees what happens when we buy Ghanaian.",
    category: "Story", author: "Efua Nyarko", image: "/output/images/hero.jpg", featured: true, createdAt: now(2),
  },
  {
    id: randomUUID(), title: "Understanding the Constitution: the supremacy clause, simply",
    body: "Article 1(2) of the Constitution of Ghana — what it means, why it matters, and how it protects every Ghanaian's freedom and peace. A plain-language explainer for every home.",
    category: "Civic", author: "Fifi Tetteh", image: "/output/images/civic.jpg", featured: false, createdAt: now(1),
  },
];

const sampleNotifications: Notification[] = [  {
    id: randomUUID(), memberId: "admin-ama", type: "reply",
    title: "Fifi Tetteh replied to your discussion",
    body: "Re: Why the Constitution must stay above every institution",
    read: false, createdAt: now(1, 3),
  },
  {
    id: randomUUID(), memberId: "admin-ama", type: "like",
    title: "Yaw Adjei liked your discussion",
    body: "Welcome! Tell us your Ghana story",
    read: true, createdAt: now(2, 5),
  },
  {
    id: randomUUID(), memberId: "admin-ama", type: "broadcast",
    title: "Akwaaba to Adom Circle 🇬🇭",
    body: "Welcome to the circle! Explore projects, join the forum, and earn rank points as you contribute.",
    read: false, createdAt: now(5),
  },
  {
    id: randomUUID(), memberId: "m-kofi", type: "reply",
    title: "Akua Boateng replied to your discussion",
    body: "Re: Volunteer hours: let's track our real impact",
    read: false, createdAt: now(1, 1),
  },
  {
    id: randomUUID(), memberId: "m-kofi", type: "event",
    title: "New event: Voter Registration Drive — Kumasi",
    body: "12 Aug · 09:00 – 15:00 · Kejetia Hub",
    read: true, createdAt: now(3),
  },
  {
    id: randomUUID(), memberId: "m-yaw", type: "like",
    title: "Kwame Asante liked your discussion",
    body: "Investing back home: what actually works",
    read: false, createdAt: now(0, 8),
  },
  {
    id: randomUUID(), memberId: "m-yaw", type: "broadcast",
    title: "Diaspora chapter launch in Toronto 🇨🇦",
    body: "Our first diaspora chapter meetup is planned — details coming soon.",
    read: false, createdAt: now(2),
  },
  {
    id: randomUUID(), memberId: "m-sena", type: "system",
    title: "Welcome, Sena! 🎓",
    body: "You joined as a New Member. Post a discussion or RSVP to an event to earn your first rank points.",
    read: false, createdAt: now(0, 2),
  },
  {
    id: randomUUID(), memberId: "m-akua", type: "event",
    title: "New event: Health Screening Outreach — Koforidua",
    body: "5 days · 08:00 – 14:00 · Koforidua Community Centre",
    read: false, createdAt: now(1, 6),
  },
];

export async function seed() {
  const [memberCount, roomCount, threadCount, projectCount, settingsCount] =
    await Promise.all([
      memberKV.getAllItems(),
      roomKV.getAllItems(),
      threadKV.getAllItems(),
      projectKV.getAllItems(),
      settingsKV.getAllItems(),
    ]);

  if (memberCount.length === 0) {
    for (const m of members) {
      const { salt, hash } = hashPassword(DEMO_PASSWORD);
      await memberKV.setItem(m.id, {
        ...m,
        salt,
        passwordHash: hash,
        emailVerified: true,
        verifyToken: null,
        verifyExpires: null,
        resetToken: null,
        resetExpires: null,
        following: [],
        followerCount: 0,
        savedMessages: [],
        status: "active",
      });
    }
  }
  if (roomCount.length === 0) {
    for (const r of rooms) await roomKV.setItem(r.id, r);
  }
  if (threadCount.length === 0) {
    for (const t of threads)
      await threadKV.setItem(t.id, { ...t, editedAt: null });
    for (const r of replies)
      await replyKV.setItem(r.id, { ...r, editedAt: null, deleted: false });
    for (const m of messages)
      await messageKV.setItem(m.id, {
        ...m,
        replyToId: null,
        reactions: {},
        savedBy: [],
        editedAt: null,
        deleted: false,
        mentions: [],
        audio: null,
      });
    for (const r of reports) await reportKV.setItem(r.id, r);
  }
  if (projectCount.length === 0) {
    for (const p of projects) await projectKV.setItem(p.id, p);
    for (const c of contributions) await contributionKV.setItem(c.id, c);
  }
  if (settingsCount.length === 0) {
    await settingsKV.setItem("settings", DEFAULT_SETTINGS);
  }
  const existingPosts = await postKV.getAllItems();
  if (existingPosts.length === 0) {
    for (const p of posts) await postKV.setItem(p.id, p);
  }
  const existingEvents = await eventKV.getAllItems();
  if (existingEvents.length === 0) {
    for (const e of events) await eventKV.setItem(e.id, e);
  }
  const existingAds = await adKV.getAllItems();
  if (existingAds.length === 0) {
    for (const a of ads) await adKV.setItem(a.id, a);
  }
  const existingNotifs = await notificationKV.getAllItems();
  if (existingNotifs.length === 0) {
    for (const n of sampleNotifications) await notificationKV.setItem(n.id, n);
  }
  const existingEmails = await emailKV.getAllItems();
  if (existingEmails.length === 0) {
    const welcome: OutboxEmail = {
      id: randomUUID(),
      to: "admin@adomcircle.org",
      subject: "Adom Circle is live 🎉",
      body: "Welcome to the Adom Circle admin panel. This is the demo mailbox — in production, real emails (verification codes, password resets) are delivered to members' inboxes.",
      debugCode: null,
      sentAt: now(1),
      read: false,
    };
    await emailKV.setItem(welcome.id, welcome);
  }
}
