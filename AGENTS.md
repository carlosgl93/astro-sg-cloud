# AI Agent Instructions - SG Cloud Project

## Project Overview

**Project Name:** SG Cloud - Tech Consultancy Portfolio  
**Technology Stack:** Astro 5.0, Tailwind CSS, Preact (minimal), Firebase  
**Purpose:** Company portfolio website showcasing services, team, and success cases

## Business Information

### Company: SG Cloud

**Type:** Tech Consultancy Business  
**Focus:** Modern web solutions and AI development

**Core Services:**

1. **Websites** - Modern, fast, SEO-optimized web applications using latest frameworks
2. **Apps & PWAs** - Progressive web applications with native-like experiences
3. **Scrapers & Bots** - Automated data collection and processing solutions
4. **AI Models** - Custom machine learning solutions tailored to client needs
5. **AI Chatbots** - Intelligent conversational interfaces for customer service and automation

**Target Audience:**

- Small to medium businesses looking to establish or enhance their digital presence
- Startups needing technical expertise
- Companies seeking automation and AI solutions
- Businesses wanting to modernize their tech stack

### Team

**Carlos Gumucio** - Co-founder & Developer

- Full-stack development
- AI/ML implementation
- Technical architecture

**Benjamin Sepulveda** - Co-founder & Developer

- Full-stack development
- Web automation
- Frontend specialization

**Contact:**

- WhatsApp: +569 39242145 (Primary contact - Carlos)
- Business Hours: Chilean timezone

## Technical Architecture

### Frontend Philosophy

- **Astro Islands Architecture**: Ship minimal JavaScript, use islands for interactivity
- **Preact for Interactivity**: Only where absolutely necessary (forms, dynamic components)
- **Static-First**: Most content should be static/pre-rendered
- **Performance**: Aim for 90+ Lighthouse scores

### Firebase Services Used

- **Hosting**: Primary deployment platform
- **Firestore**: Database for contact form submissions, testimonials
- **Storage**: Image and asset storage
- **Functions**: Backend logic (form processing, email notifications)

### Key Design Principles

1. **Lean & Fast**: Minimize bundle size, maximize performance
2. **SEO Optimized**: Meta tags, semantic HTML, structured data
3. **Mobile-First**: Responsive design, touch-friendly interfaces
4. **Accessibility**: WCAG compliance, keyboard navigation
5. **Dark Mode**: Full support for system preference and manual toggle

## Site Structure

### Pages

1. **Homepage (/)**
   - Hero section with company overview
   - Services showcase
   - Why choose SG Cloud section
   - Success cases preview
   - Call-to-action to contact

2. **Services (/services)**
   - Detailed service descriptions
   - Technology stack for each service
   - Pricing indicators (optional)

3. **About (/about)**
   - Company story
   - Team profiles (Carlos & Benjamin)
   - Values and mission

4. **Success Cases (/cases or testimonials section on homepage)**
   - Client testimonials
   - Case studies
   - Project highlights
   - Results and metrics

5. **Contact (/contact)**
   - Contact form that redirects to WhatsApp
   - Direct WhatsApp link: +569 39242145
   - Business information
   - Response time expectations

### Components to Keep

- Header with navigation
- Footer with social links
- Hero sections
- Features/Services grid
- Testimonials/Stats
- Contact forms
- Call-to-action widgets

### Components to Remove/Modify

- Blog functionality (unless needed later)
- Multiple homepage variants
- Unnecessary landing pages
- Netlify/Vercel specific configs

## Content Guidelines

### Tone of Voice

- **Professional** but approachable
- **Technical** but not jargon-heavy
- **Confident** without being arrogant
- **Solution-focused**
- **Bilingual ready**: Primarily Spanish, English support

### Key Messaging

- "We build modern digital solutions that drive business growth"
- "From concept to deployment, we handle it all"
- "Specialized in cutting-edge tech: AI, automation, modern web"
- "Small team, big expertise, personalized service"

### Value Propositions

1. **Full-Stack Expertise**: Both founders are experienced full-stack developers
2. **Modern Tech Stack**: Always using latest, proven technologies
3. **AI Specialization**: Cutting-edge AI and automation capabilities
4. **Personalized Service**: Direct communication with founders, no intermediaries
5. **Fast Turnaround**: Agile methodology, quick iterations
6. **Transparent Process**: Clear communication, regular updates

## Development Workflow

### When Making Changes

1. Test locally first (`pnpm dev`)
2. Check build (`pnpm build`)
3. Preview production build (`pnpm preview`)
4. Deploy to Firebase (`firebase deploy`)

### Code Standards

- TypeScript for type safety
- ESLint + Prettier for code formatting
- Component-based architecture
- Reusable utilities in `/src/utils`
- Semantic HTML
- CSS via Tailwind classes

### File Organization

```
src/
  components/
    widgets/     # Page sections (Hero, Features, etc.)
    ui/          # Reusable UI components
    common/      # Shared components (Header, Footer)
  layouts/       # Page templates
  pages/         # Routes
  utils/         # Helper functions
  assets/        # Images, styles
  config.yaml    # Site configuration
```

## Deployment & Configuration

### Firebase Setup

- Hosting: Configured for SPA with Astro build output
- Firestore: Rules for contact form submissions
- Functions: Handle form processing, send to WhatsApp/Email
- Storage: Optimized images, team photos, case study assets

### Environment Variables

- Firebase config (API keys, project ID)
- WhatsApp Business API settings (if used)
- Analytics IDs
- Contact email addresses

### Unused Files to Remove

- `netlify.toml` - Not using Netlify
- `vercel.json` - Not using Vercel
- `.stackblitzrc` - Not needed for production
- `sandbox.config.json` - Not needed for production
- Template demo content in `/src/data/post`

## Contact Form Behavior

### Primary Method: WhatsApp Redirect

When user submits contact form:

1. Capture: name, email, message
2. Format message for WhatsApp
3. Redirect to: `https://wa.me/56939242145?text=[pre-filled message]`
4. (Optional) Also save to Firestore for records

### Message Format

```
Hello! I'm [Name] and I'm interested in SG Cloud's services.

Email: [email]
Message: [message]
```

### Fallback

- If WhatsApp fails, show email: contact@sgcloud.cl (or actual email)
- Display phone number for direct call

## AI Agent Specific Instructions

### When Updating Content

- Always maintain brand consistency (colors, fonts, tone)
- Keep performance in mind - optimize images, minimize JS
- Test responsive design on mobile, tablet, desktop
- Ensure accessibility (alt tags, ARIA labels, keyboard navigation)

### When Adding Features

- Prefer Astro components over JavaScript frameworks
- Only use Preact when interactivity is essential
- Keep bundle size minimal
- Document any new dependencies

### When Debugging

- Check Astro dev server logs
- Inspect Firebase console for backend errors
- Use Lighthouse for performance analysis
- Test forms thoroughly before deployment

### When Asked About Business

- Reference services: websites, apps, PWAs, scrapers, bots, AI models, chatbots
- Highlight team: Carlos Gumucio, Benjamin Sepulveda
- Contact: WhatsApp +569 39242145
- Location: Chile (Spanish/English)
- Platform: Firebase (not Netlify/Vercel)

## Future Enhancements (Possible)

- Blog for technical articles
- Portfolio/case studies with detailed breakdowns
- Client dashboard (Firebase Auth)
- Multi-language support (ES/EN)
- Live chat integration
- Booking/scheduling system
- Payment integration for services

---

**Last Updated:** January 25, 2026  
**Maintained By:** SG Cloud Team
