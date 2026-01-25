# ☁️ SG Cloud - Tech Consultancy Portfolio

**SG Cloud** is a tech consultancy business specializing in modern web solutions. This is our company portfolio and website built with **[Astro 5.0](https://astro.build/)**, **[Tailwind CSS](https://tailwindcss.com/)**, and deployed on **[Firebase](https://firebase.google.com/)**.

## 🏢 About SG Cloud

We create cutting-edge digital solutions including:

- 🌐 **Websites** - Modern, fast, and SEO-optimized web applications
- 📱 **Apps & PWAs** - Progressive web applications and mobile apps
- 🤖 **Scrapers & Bots** - Automated data collection and processing tools
- 🧠 **AI Models** - Custom machine learning solutions
- 💬 **AI Chatbots** - Intelligent conversational interfaces

## 👥 Team

- **Carlos Gumucio** - Co-founder & Developer
- **Benjamin Sepulveda** - Co-founder & Developer

## 🚀 Tech Stack

- **Frontend**: Astro 5.0 with Astro Islands architecture
- **Styling**: Tailwind CSS
- **Interactivity**: Preact (where needed)
- **Backend**: Firebase (Hosting, Firestore, Storage, Functions)
- **Package Manager**: pnpm

## ✨ Features

- ✅ Lightning-fast static site generation with Astro
- ✅ Minimal JavaScript - Astro Islands with Preact for interactive components
- ✅ Responsive design with Tailwind CSS
- ✅ Dark mode support
- ✅ Firebase integration for backend services
- ✅ Contact form with WhatsApp integration
- ✅ Testimonials and success cases showcase
- ✅ SEO optimized

<br>

<details open>
<summary>Table of Contents</summary>

- [About SG Cloud](#-about-sg-cloud)
- [Team](#-team)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Commands](#commands)
- [Firebase Configuration](#firebase-configuration)
- [Deployment](#deployment)
- [Contact](#contact)
- [License](#license)

</details>

<br>

## Getting Started

### Prerequisites

- Node.js 18.17.1+ or 20.3.0+ or 21.0.0+
- pnpm (recommended package manager)
- Firebase account for deployment

### Installation

1. Clone this repository:

```shell
git clone <repository-url>
cd astro-sg-cloud
```

2. Install dependencies:

```shell
pnpm install
```

3. Start the development server:

```shell
pnpm dev
```

The site will be available at `http://localhost:4321`

### Project Structure

```
/
├── public/              # Static assets
├── src/
│   ├── assets/         # Images, styles, favicons
│   ├── components/     # Astro and Preact components
│   │   ├── widgets/   # Reusable widget components
│   │   └── ui/        # UI components
│   ├── layouts/       # Page layouts
│   ├── pages/         # File-based routing
│   ├── utils/         # Utility functions
│   ├── config.yaml    # Site configuration
│   └── navigation.ts  # Navigation structure
├── firebase.json       # Firebase configuration (to be added)
├── package.json
└── astro.config.ts
```

<br>

### Commands

All commands are run from the root of the project:

| Command        | Action                                     |
| :------------- | :----------------------------------------- |
| `pnpm install` | Install dependencies                       |
| `pnpm dev`     | Start local dev server at `localhost:4321` |
| `pnpm build`   | Build production site to `./dist/`         |
| `pnpm preview` | Preview build locally before deploying     |
| `pnpm check`   | Check project for errors                   |
| `pnpm fix`     | Run ESLint and format with Prettier        |

<br>

### Firebase Configuration

This project uses Firebase for hosting and backend services. To set up:

1. Install Firebase CLI:

```shell
npm install -g firebase-tools
```

2. Login to Firebase:

```shell
firebase login
```

3. Initialize Firebase in your project:

```shell
firebase init
```

Select the following services:

- Hosting
- Firestore
- Storage
- Functions (if needed)

4. Configure `firebase.json` for Astro deployment (build output is in `dist/`)

<br>

### Deployment

#### Deploy to Firebase

Build and deploy to Firebase Hosting:

```shell
pnpm build
firebase deploy
```

Or use the Firebase CLI for automatic deployment:

```shell
firebase deploy --only hosting
```

<br>

## Contact

**SG Cloud**  
Tech Consultancy Services

📱 WhatsApp: +569 39242145  
🌐 Website: [Coming Soon]

**Team:**

- Carlos Gumucio
- Benjamin Sepulveda

---

## License

This project is based on the AstroWind template, licensed under the MIT license — see the [LICENSE](./LICENSE.md) file for details.

Built with ❤️ by SG Cloud
