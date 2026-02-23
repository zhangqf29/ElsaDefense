# Elsa Nova Defense (Elsa新星防御)

A classic Missile Command style tower defense game built with React, Tailwind CSS, and Motion.

## Features
- **Magical Theme**: Defend Hogwarts-style castles using Nimbus 2000 broomsticks as interceptors.
- **Triple Shot**: Each battery fires three magical projectiles at once for maximum defense.
- **Responsive Design**: Play on desktop or mobile with smooth touch/click controls.
- **Bilingual Support**: Toggle between English and Chinese.

## Tech Stack
- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Animations**: Motion (formerly Framer Motion)
- **Icons**: Lucide React
- **Build Tool**: Vite

## Deployment to Vercel

1. **Push to GitHub**:
   - Create a new repository on GitHub.
   - Initialize git in your local project:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin <your-github-repo-url>
     git push -u origin main
     ```

2. **Connect to Vercel**:
   - Go to [Vercel](https://vercel.com) and click "Add New" -> "Project".
   - Import your GitHub repository.
   - **Environment Variables**: If you plan to use Gemini AI features, add `GEMINI_API_KEY` in the Vercel project settings.
   - Click "Deploy".

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## License
Apache-2.0
