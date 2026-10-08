CineMatch 🎬
A Modern Movie Discovery & Watchlist Web Application
A modern, production-grade movie discovery and watchlist application built with vanilla HTML5, CSS3, and JavaScript (ES6+), powered by the OMDb API.

✨ Features
🎬 Featured Hero Banner: Dynamically showcases top movies with high-resolution posters, IMDb ratings, and instant details.
🔍 Real-Time Search with Debouncing: Instant search as you type, optimized with a 400ms debounce to prevent redundant API calls.
🏷️ Filtering & Type Selection: Filter results by content type (Movies, Series, Episodes) and search parameters.
📋 Rich Movie Details Modal: Detailed plot synopsis, cast members, director, genre tags, runtime, release date, ratings, and box office figures.
❤️ Persistent Watchlist (localStorage): Save your favorite titles across browser sessions with one click, live badge counters, and toast notifications.
⚡ Loading Skeletons & Error Handling: Shimmer skeleton cards during data fetching, clean error messages for invalid keys or missing results.
📱 Fully Responsive Dark Cinema Theme: Fluid CSS Grid layout that adapts seamlessly to desktop, tablet, and mobile screens.

🛠️ Tech Stack
Frontend: HTML5, CSS3 (Flexbox & Grid), JavaScript (ES6+ Modules)
API: OMDb API (Open Movie Database)
Storage: Web Storage API (localStorage)
Deployment: GitHub Pages

🚀 Getting Started
1. Obtain a Free OMDb API Key
Go to OMDb API Key Request and select the Free tier.
Enter your email address to submit the request.
Check your inbox for a confirmation email and click the verification link to activate your API key.
Copy your newly activated key.
2. Configure Your API Key
You can configure your API key in either of two easy ways:
Option A: Via the Web UI (Easiest)
Open index.html in your browser.
A setup dialog will appear automatically (or click the ⚙️ Settings icon in the top right).
Paste your OMDb API key and click Save & Connect. Your key is saved locally in your browser's localStorage.
Option B: In js/config.js (Direct Code)
Open js/config.js and paste your key into OMDB_CONFIG.API_KEY:
3. Run the Project
const OMDB_CONFIG = {
  API_KEY: 'YOUR_OMDB_API_KEY_HERE',
  BASE_URL: 'https://www.omdbapi.com/'
};

Because CineMatch uses standard browser APIs (fetch, localStorage), you can run it simply by opening index.html in any modern web browser:
Double-click index.html or drag it into Google Chrome, Firefox, Safari, or Edge.
Or serve using a local static server:
Then visit http://localhost:3000.



📁 Project Structure

cinematch/
├── index.html        # Main HTML layout, search interface, and modal dialogs
├── css/
│   └── style.css     # Dark cinematic theme, grid layout, animations, and media queries
├── js/
│   ├── config.js     # OMDb API keys, endpoints, and localStorage configuration
│   ├── api.js        # OMDb API service layer (fetch calls & async error handling)
│   └── app.js        # State management, DOM manipulation, debouncing, and UI events
└── README.md         # Project documentation

🌐 Deploying to GitHub Pages
Push your repository to GitHub.
Navigate to Settings > Pages in your GitHub repository.
Under Source, select Deploy from a branch and choose main (or master).
Click Save. Your site will be published at https://<username>.github.io/<repository-name>.

⚖️ Attribution
This product uses the OMDb API but is not endorsed or certified by OMDb.

