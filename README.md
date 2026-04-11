# Sales Dashboard Web Application

A full-stack sales analytics dashboard that visualizes revenue, orders, units sold, and product performance using a FastAPI backend and a lightweight HTML/CSS/JavaScript frontend.

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

### 6. Configure frontend API URL
Edit `frontend/js/config.js`:

```js
window.__APP_CONFIG__ = {
  API_BASE: "http://127.0.0.1:8000",
};
```

### 7. Run frontend
```bash
cd frontend
python -m http.server 5500


Then open:

http://127.0.0.1:5500/index.html


