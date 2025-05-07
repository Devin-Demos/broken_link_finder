# Link Checker for Journalists

A web-based tool for journalists to check for broken links on a webpage.

## Features

- Clean, user-friendly interface for non-technical users
- Input a single URL to check
- Extracts all internal and external links from the webpage
- Checks each link for validity
- Displays results in a clear table showing:
  - Link URL
  - HTTP status or error message
  - Visual indication of valid/broken links
- Download the report as a CSV file

## Technology Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React with TypeScript
- **UI Components**: Tailwind CSS with shadcn/ui
- **HTTP Requests**: Axios

## Local Development

### Backend

```bash
cd backend
poetry install
poetry run fastapi dev app/main.py
```

The backend server will run on http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will run on http://localhost:5173

## Usage

1. Enter a URL in the input field (e.g., https://example.com)
2. Click the "Check Links" button
3. View the results in the table
4. Click "Download CSV" to export the results
