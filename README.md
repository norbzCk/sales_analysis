## Sales Dashboard Web Application

A full-stack sales analytics dashboard that visualizes revenue, orders, units sold, and product performance using a FastAPI backend and a lightweight HTML/CSS/JavaScript frontend.

## Features

## Real-time sales statistics

Total revenue

Total orders

Units sold

Top-selling product# Sales Dashboard Web Application

A full-stack sales analytics dashboard for tracking revenue, orders, units sold, and product performance.  
The backend is built with FastAPI + SQLAlchemy, and the frontend uses HTML/CSS/JavaScript with Chart.js.

## Features

- Real-time sales stats
- Revenue by product (bar chart)
- Revenue over time (line chart)
- Product and customer management
- Sales and payments endpoints

## Tech Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Uvicorn

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js

## Project Setup

### 1. Clone
```bash
git clone https://github.com/norbzCk/sales_analysis.git
cd sales_analysis
```

### 2. Create and activate one virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```

Use the same environment every time you work on this project:
```bash
cd ~/sales_project/sales_analysis
source venv/bin/activate
```

### 3. Install dependencies
```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 4. Configure database
Current default database URL in `backend/database.py`:

`postgresql://postgres:postgres123@localhost:5432/sales_db`

Make sure PostgreSQL is running and that database/user credentials match.

### 5. Run backend
```bash
python -m uvicorn backend.app.main:app --reload
```

Backend/API:
- `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

### 6. Run frontend (optional static server)
In a new terminal:
```bash
cd frontend
python3 -m http.server 5500
```

Frontend:
- `http://127.0.0.1:5500/index.html`




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

3: Install dependencies
pip install fastapi uvicorn sqlalchemy

4: Initialize the database
python backend/init_db.py

5: Start the backend server
uvicorn backend.app.main:app --reload


API will be available at:

http://127.0.0.1:8000

and UI at:

http://127.0.0.1:8000/docs

6:Run the frontend

Open the frontend using a local server:

cd frontend
python -m http.server 5500


Then open:

http://127.0.0.1:5500/index.html



