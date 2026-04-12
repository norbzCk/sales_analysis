# Sales Dashboard Web Application

A full-stack sales analytics dashboard that visualizes revenue, orders, units sold, and product performance using a FastAPI backend. The repository now contains both the original lightweight HTML/CSS/JavaScript frontend and a new React + TypeScript frontend architecture for incremental migration.

## Features

## Real-time sales statistics

Total revenue

Total orders

Units sold

Top-selling product

## Interactive charts

Revenue by product (Bar Chart)

Revenue over time (Line Chart)

## FastAPI REST API

#SQLAlchemy ORM for database access

# Clean and a responsive dashboard UI

## Tech Stack
# Backend

Python

FastAPI

SQLAlchemy

PostgreSQL

Uvicorn

 # Frontend

HTML5

CSS3

Vanilla JavaScript

Chart.js

React

TypeScript

Vite


## Setup & Installation
1: Clone the repository
git clone "https://github.com/norbzCk/sales_analysis.git"
cd sales-dashboard

2: Create a virtual environment
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies
```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 4. Configure environment variables
The backend now reads env vars:

- `DATABASE_URL` (required in production)
- `APP_SECRET_KEY` (required in production)
- `CORS_ORIGINS` (comma-separated list, recommended in production)

Example local values:
```bash
export DATABASE_URL='postgresql://postgres:postgres123@localhost:5432/sales_db'
export APP_SECRET_KEY='change-this-to-a-long-random-secret'
export CORS_ORIGINS='http://127.0.0.1:5500,http://localhost:5500'
```

### 5. Run backend
```bash
uvicorn backend.app.main:app --reload
```

Backend/API:
- `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

### 6. Choose frontend architecture

Legacy frontend:

### 6a. Configure legacy frontend API URL
Edit `frontend/js/config.js`:

```js
window.__APP_CONFIG__ = {
  API_BASE: "http://127.0.0.1:8000",
};
```

### 7a. Run legacy frontend
```bash
cd frontend
python -m http.server 5500


Then open:

http://127.0.0.1:5500/index.html

React + TypeScript frontend:

### 6b. Run the new frontend

```bash
cd frontend-react
npm install
npm run dev
```

Optional API override:

```bash
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

Then open:

`http://127.0.0.1:5173`

The React app is an architecture-first migration:

- It preserves the same product aim and backend API
- It centralizes routes, auth state, and HTTP access
- It creates dedicated feature boundaries for the remaining page migrations


