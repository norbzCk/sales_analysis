## Sales Dashboard Web Application

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
git clone https://github.com/yourusername/sales-dashboard.git
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

