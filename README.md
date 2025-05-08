# Broken Link Finder

A web application that helps you find and manage broken links on your website. This tool allows you to scan URLs for broken links and provides a user-friendly interface to view and manage the results.

## Features

- Scan websites for broken links
- View detailed results of broken link scans
- Modern and responsive UI built with React and Tailwind CSS
- Real-time link validation
- Export scan results

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:
```sh
git clone <repository-url>
cd broken-link-finder
```

2. Install dependencies:
```sh
npm install
```

3. Start the development server:
```sh
npm run dev
```

The application will be available at `http://localhost:5173` by default.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check code quality

## Technologies Used

- **Frontend Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **Form Handling**: React Hook Form with Zod validation
- **HTTP Client**: TanStack Query
- **UI Components**: Radix UI primitives
- **Development**: ESLint, TypeScript

## Development

The project uses modern web development tools and practices:

- TypeScript for type safety
- ESLint for code linting
- Tailwind CSS for styling
- shadcn/ui for pre-built components
- React Router for navigation
- React Query for data fetching