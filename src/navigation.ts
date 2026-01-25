import { getPermalink } from './utils/permalinks';

type Locale = 'es' | 'en';

// Helper to get localized path
const getLocalizedPath = (path: string, locale: Locale = 'es') => {
  if (locale === 'es') {
    return getPermalink(path);
  }
  return getPermalink(`/en${path}`);
};

// Navigation data factory based on locale
export const getHeaderData = (locale: Locale = 'es') => {
  const translations = {
    es: {
      home: 'Inicio',
      services: 'Servicios',
      about: 'Nosotros',
      contact: 'Contacto',
      whatsapp: 'WhatsApp',
      whatsappMessage: '¡Hola! Estoy interesado en los servicios de SG Cloud.',
    },
    en: {
      home: 'Home',
      services: 'Services',
      about: 'About',
      contact: 'Contact',
      whatsapp: 'WhatsApp',
      whatsappMessage: "Hello! I'm interested in SG Cloud's services.",
    },
  };

  const t = translations[locale];

  return {
    links: [
      {
        text: t.home,
        href: getLocalizedPath('/', locale),
      },
      {
        text: t.services,
        href: getLocalizedPath('/services', locale),
      },
      {
        text: t.about,
        href: getLocalizedPath('/about', locale),
      },
      {
        text: t.contact,
        href: getLocalizedPath('/contact', locale),
      },
    ],
    actions: [
      {
        text: t.whatsapp,
        href: `https://wa.me/56939242145?text=${encodeURIComponent(t.whatsappMessage)}`,
        target: '_blank',
      },
    ],
  };
};

export const getFooterData = (locale: Locale = 'es') => {
  const translations = {
    es: {
      servicesTitle: 'Servicios',
      websites: 'Sitios Web',
      apps: 'Apps y PWAs',
      aiSolutions: 'Soluciones de IA',
      automation: 'Automatización',
      companyTitle: 'Empresa',
      aboutUs: 'Nosotros',
      contact: 'Contacto',
      privacy: 'Privacidad',
      terms: 'Términos',
      footNote:
        'Hecho por <a class="text-blue-600 hover:underline dark:text-muted" href="/"> SG Cloud</a> · Todos los derechos reservados.',
    },
    en: {
      servicesTitle: 'Services',
      websites: 'Websites',
      apps: 'Apps & PWAs',
      aiSolutions: 'AI Solutions',
      automation: 'Automation',
      companyTitle: 'Company',
      aboutUs: 'About Us',
      contact: 'Contact',
      privacy: 'Privacy',
      terms: 'Terms',
      footNote:
        'Made by <a class="text-blue-600 hover:underline dark:text-muted" href="/"> SG Cloud</a> · All rights reserved.',
    },
  };

  const t = translations[locale];

  return {
    links: [
      {
        title: t.servicesTitle,
        links: [
          { text: t.websites, href: getLocalizedPath('/services#websites', locale) },
          { text: t.apps, href: getLocalizedPath('/services#apps', locale) },
          { text: t.aiSolutions, href: getLocalizedPath('/services#ai', locale) },
          { text: t.automation, href: getLocalizedPath('/services#automation', locale) },
        ],
      },
      {
        title: t.companyTitle,
        links: [
          { text: t.aboutUs, href: getLocalizedPath('/about', locale) },
          { text: t.contact, href: getLocalizedPath('/contact', locale) },
          { text: t.privacy, href: getLocalizedPath('/privacy', locale) },
          { text: t.terms, href: getLocalizedPath('/terms', locale) },
        ],
      },
    ],
    secondaryLinks: [
      { text: t.terms, href: getLocalizedPath('/terms', locale) },
      { text: t.privacy, href: getLocalizedPath('/privacy', locale) },
    ],
    socialLinks: [
      { ariaLabel: 'WhatsApp', icon: 'tabler:brand-whatsapp', href: 'https://wa.me/56939242145' },
      { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: '#' },
      { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: '#' },
    ],
    footNote: `
      <span class="w-5 h-5 md:w-6 md:h-6 md:-mt-0.5 bg-cover mr-1.5 rtl:mr-0 rtl:ml-1.5 float-left rtl:float-right rounded-sm"></span>
      ${t.footNote}
    `,
  };
};

// Default exports for backward compatibility (Spanish)
export const headerData = getHeaderData('es');
export const footerData = getFooterData('es');
