# SmartMess

SmartMess is a web application for managing food demand and waste in college messes and cafeterias.

## Features

- Record breakfast, lunch, and dinner data.
- Calculate food waste automatically.
- Track meals served and food prepared.
- View meal history from MongoDB.
- Visualize food preparation, meals served, and waste using charts.
- Predict meal demand using machine learning *(planned)*.

## Tech Stack

- **Frontend:** React, Vite
- **Backend:** Python, Flask
- **Database:** MongoDB Atlas
- **Machine Learning:** Pandas, Scikit-learn *(planned)*

## Project Structure

```text
smart-food-management/
├── backend/
│   └── app.py
├── frontend/
│   ├── src/
│   └── package.json
├── .gitignore
└── README.md
```

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/nitin-chahar/smart-food-management.git
cd smart-food-management
```

### 2. Run the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment on Git Bash:

```bash
source .venv/Scripts/activate
```

Install dependencies:

```bash
pip install Flask flask-cors pymongo python-dotenv
```

Create a `backend/.env` file and add your MongoDB connection string:

```env
MONGO_URI=your_mongodb_connection_string
```

Start Flask:

```bash
python app.py
```

### 3. Run the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL shown in the terminal.

