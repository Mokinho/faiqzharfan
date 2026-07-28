// Content pulled from https://mokinho.github.io/ — single source of truth for the game's UI panels.

export const PROFILE = {
  name: 'Faiq Zharfan',
  role: 'Full-Stack WordPress Developer — 4+ Years Experience',
  tagline: 'I build websites that are fast, secure & built to grow.',
  location: 'Based in Malaysia, currently building at Sterrific',
  resume: 'https://heyzine.com/flip-book/d16ab31dd3.html',
};

export const ABOUT = {
  paragraphs: [
    'I discovered my passion for coding during university when I wrote my first “Hello, World!” program in Python — and that moment changed my career path forever. What began as curiosity quickly grew into a lifelong enthusiasm for web development, where creativity meets problem-solving.',
    'With a naturally extroverted personality, I enjoy collaborating with people and transforming their ideas into digital realities. My focus lies in front-end development and WordPress customization, where I blend technical expertise with design principles to build websites that are responsive, secure, and visually engaging across both web and mobile platforms.',
    'I take pride in delivering complete end-to-end solutions — from Custom Post Types (CPT) and ACF integrations to pro plugin customization, hosting setup, site migration, SSL, DNS, and email management. Beyond development, I troubleshoot issues across all hosting providers, whether cPanel-based or managed cloud hosting.',
    "For me, web development isn't just about writing code — it's about creating meaningful digital experiences that help businesses grow, backed by reliable and scalable technical foundations.",
  ],
  timeline: [
    { date: 'Feb 2025 — Present', title: 'Web Developer', org: 'Sterrific Sdn Bhd' },
    { date: '2024', title: 'Web Developer', org: 'MacGad Technology Sdn Bhd' },
    { date: '2020 — 2024', title: 'Web Developer / Assistant Chief IT / Graphic Designer', org: 'Yayasan Pasir Gudang' },
    { date: '2020', title: 'Intern, Junior Programmer', org: 'Nestlé Malaysia Sdn Bhd' },
  ],
};

export const SKILLS = [
  {
    title: 'Front-End & Design',
    items: ['Responsive design & website optimization', 'HTML, CSS, JavaScript', 'Expanding into React, Angular & jQuery'],
  },
  {
    title: 'WordPress & CMS',
    items: ['Custom Post Types (CPT) & ACF integrations', 'Elementor, WPBakery, Visual Composer', 'WooCommerce, theme & custom builds', 'Drupal (Intermediate)'],
  },
  {
    title: 'Infrastructure & Hosting',
    items: ['Hosting, DNS, SSL & email setup', 'Site migration, FileZilla, DirectAdmin', 'Troubleshooting — cPanel, cloud & managed hosting'],
  },
  {
    title: 'Marketing & Analytics',
    items: ['SEO optimization', 'Google Ads & Google Tag Manager', 'Power BI & PowerApps'],
  },
  {
    title: 'Design Tools',
    items: ['Photoshop', 'Illustrator', 'Webflow'],
  },
  {
    title: 'Programming & AI Tools',
    items: ['Python, PHP, Java, C#, C++', 'Claude AI, ChatGPT Pro, Gemini & Blackbox — my daily AI pair-programmers', 'VS Code, supercharged with MCP connectors linking my tools together', 'Always learning something new'],
  },
];

export const CONTACT = {
  lead: "Have a project in mind, or need help with a website — from scratch, or a rebuild? Let's talk.",
  links: [
    { label: 'Email', value: 'muhammadfaiqzharfan.johari@gmail.com', href: 'mailto:muhammadfaiqzharfan.johari@gmail.com' },
    { label: 'WhatsApp', value: 'Message me directly', href: 'https://wa.link/dkr48l' },
    { label: 'LinkedIn', value: 'muhammadfaiqzharfanjohari1997', href: 'https://www.linkedin.com/in/muhammadfaiqzharfanjohari1997/' },
    { label: 'Resume', value: 'View full CV', href: PROFILE.resume },
  ],
};

// colorA/colorB carried over from the mockup gradients on the original site where available.
// icon selects the procedural graphic drawn on the billboard (see drawIcon in world.js),
// matching the icon-* classes used on the mockup cards of the original site.
export const PROJECTS = [
  { tag: 'Website Revamp', title: 'Sterrific', desc: 'Full revamp of the Sterrific company website — rebuilt for a cleaner, more responsive experience with improved performance.', link: 'https://www.sterrific.com.my/', colorA: '#101820', colorB: '#c8ff3d', icon: 'globe' },
  { tag: 'Rebuild & Migration', title: '3D Resources', desc: 'Rebuilt from static HTML into a full WordPress platform, with complete migration — hosting, DNS and content included.', link: 'https://www.3dresources.com.my/', colorA: '#141414', colorB: '#4fb6ff', icon: 'cube' },
  { tag: 'Branding Website · Sept 2024', title: 'MokPixel', desc: "Branding website built to introduce and sell MokPixel's design & apparel line.", link: 'https://mokpixel.b12sites.com/index', colorA: '#0a0a0a', colorB: '#c8ff3d', icon: 'tag' },
  { tag: 'Landing Page · Sept 2024', title: 'Dr. Finance', desc: 'Landing page for a licensed money lender, built for clarity and lead conversion.', link: null, colorA: '#0b2340', colorB: '#1c4f82', icon: 'coin' },
  { tag: 'Website · Sept 2024', title: 'iOS Credit', desc: 'Full website for a licensed money lender, covering services, eligibility and application flow.', link: 'https://www.my-ios.com.my/', colorA: '#073b3a', colorB: '#0e7c74', icon: 'coin' },
  { tag: 'NGO Website · Sept 2024', title: 'Yayasan Pasir Gudang', desc: 'Website for the foundation, built while serving as their Web Developer & Assistant Chief IT.', link: 'https://yayasanpasirgudang.org.my/', colorA: '#5a2c0c', colorB: '#d97a2b', icon: 'people' },
  { tag: 'Auto Parts Website · Aug 2024', title: 'Easyparts Autozone', desc: 'Website for an auto parts retailer, showcasing vehicles, parts catalogue and services.', link: 'https://www.autozone.my/', colorA: '#0c2410', colorB: '#2f6b1f', icon: 'car' },
  { tag: 'Landing Page · Aug 2024', title: 'BestLoanKLSelangor', desc: 'Landing page for a licensed money lender serving the KL & Selangor area.', link: 'https://bestloanklselangor.my/', colorA: '#0a2a3a', colorB: '#16607a', icon: 'coin' },
  { tag: 'Architect Website · Aug 2024', title: 'JCS Design', desc: 'Minimal, image-led website for an architecture firm — built to let the work speak first.', link: 'https://jcsdesign.com.my/', colorA: '#1a1a1a', colorB: '#3a3a3a', icon: 'building' },
  { tag: 'Mattress Website · Aug 2024', title: 'Revor Malaysia', desc: 'E-commerce style website for a mattress brand, designed around comfort and calm.', link: null, colorA: '#241b3a', colorB: '#4a3d7a', icon: 'moon' },
  { tag: 'Website + Shop · Aug 2024', title: 'Hyperack', desc: 'Full website and online shop for an industrial racking & storage systems company.', link: 'https://hyperack.com.my/', colorA: '#1f1147', colorB: '#f5b400', icon: 'rack' },
  { tag: 'Website + SEO · Aug 2024', title: 'MacGad Technology', desc: 'Company website built alongside Google Ads & SEO work while at MacGad Technology.', link: 'https://www.macgad.com/', colorA: '#041c2c', colorB: '#0d6efd', icon: 'chart' },
  { tag: 'Web Development & Design', title: 'E-Finance Capital', desc: 'Website for a licensed money lender offering personal, business and collateral-based financing — built for trust and clarity.', link: 'https://efin.com.my', colorA: '#0a2540', colorB: '#1f5f9e', icon: 'coin' },
  { tag: 'Web Dev, Design & Hosting', title: 'Property Launch Websites', desc: 'Official sale websites for three residential launches — built and hosted end-to-end (Tengah Garden Avenue, The Lake Garden Residences, River Modern).', link: 'https://tengahgardenavenue-officialsale.com/', colorA: '#101c16', colorB: '#2f6b4a', icon: 'building' },
  { tag: 'Revamp, Design, Migration & Hosting', title: 'Endona', desc: 'Revamp and migration for an agri-tech company advancing sustainable farming, processing and training.', link: 'https://endona.com.my/', colorA: '#1b2b12', colorB: '#4f7a2e', icon: 'leaf' },
  { tag: 'Revamp, Migration & Hosting', title: 'Presto Universal', desc: 'Revamp and migration for a luxury interior fit-out and façade specialist working across Asia-Pacific.', link: 'https://prestouniversal.com/', colorA: '#141414', colorB: '#3a3a3a', icon: 'building' },
  { tag: 'Revamp, Design & Hosting', title: 'UA Aerospace', desc: 'Revamp for an aerospace consultancy handling aircraft sales, leasing and maintenance.', link: 'https://uaaerospace.com/', colorA: '#0a1a33', colorB: '#1e3f66', icon: 'plane' },
  { tag: 'Hosting, Revamp, Design & Dev', title: 'DLLC Legal', desc: 'Full hosting, revamp, design and development for a Singapore law corporation.', link: 'https://dllclegal.com/', colorA: '#14181c', colorB: '#3a4048', icon: 'column' },
  { tag: 'Maintenance, Troubleshooting & SEO', title: 'IKAN Glamp', desc: 'Ongoing maintenance, troubleshooting and SEO for a glamping resort in Janda Baik.', link: 'https://ikanglamp.co/', colorA: '#14210f', colorB: '#3a5a1f', icon: 'tent' },
  { tag: 'Web Development & Design', title: 'UoSM Intake Landing Page', desc: "Landing page built for University of Southampton Malaysia's intake enrollment campaign.", link: 'https://intake26.southamptonmalaysia.edu.my/', colorA: '#0d1b2a', colorB: '#1f4e79', icon: 'cap' },
  { tag: 'Programme Page Redesign · Drupal', title: 'UoSM Official Website', desc: "Redesigned code and templates for the university's programme pages, built on Drupal.", link: 'https://www.southamptonmalaysia.edu.my/', colorA: '#0d1b2a', colorB: '#2a6f9e', icon: 'cap' },
];
