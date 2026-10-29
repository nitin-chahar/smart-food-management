from datetime import datetime
from pathlib import Path
import os
import joblib
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client["smartmess"]
meals = db["meals"]

app = Flask(__name__)
CORS(app)

DAYS = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday",
]
MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"]
WEEKEND_DAYS = {"Saturday", "Sunday"}


def load_model():
    """Find and load the KNN pipeline. Returns None if it can't be loaded."""
    base = Path(__file__).resolve().parent
    candidates = [
        os.getenv("MODEL_PATH"),
        base / "model" / "KNN_new.joblib",
        base.parent / "model" / "KNN_new.joblib",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            try:
                return joblib.load(candidate)
            except Exception as e:
                print(f"Could not load model from {candidate}: {e}")
                return None
    print("Warning: KNN_new.joblib not found, /api/predict is disabled")
    return None


def get_known_menus(pipeline):
    """Read the menu names the model was trained on from its fitted encoder."""
    if pipeline is None:
        return []
    try:
        transformer = pipeline.steps[0][1]
        for _, fitted, cols in transformer.transformers_:
            cols = [cols] if isinstance(cols, str) else list(cols)
            if "menu" not in cols or isinstance(fitted, str):
                continue
            encoder = fitted.steps[-1][1] if hasattr(fitted, "steps") else fitted
            return sorted(str(c) for c in encoder.categories_[cols.index("menu")])
    except Exception:
        pass
    return []


model = load_model()
KNOWN_MENUS = get_known_menus(model)
MENU_LOOKUP = {name.lower(): name for name in KNOWN_MENUS}


@app.route("/")
def home():
    return jsonify({
        "message": "SmartMess API is running"
    })


@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy"
    })


@app.route("/api/summary")
def summary():
    records = list(meals.find({}, {"_id": 0}))

    def total(field):
        return round(sum(record.get(field, 0) for record in records), 2)

    food_prepared_kg = total("food_prepared_kg")
    food_consumed_kg = total("food_consumed_kg")
    food_wasted_kg = total("food_wasted_kg")
    students_served = total("students_served")

    waste_percent = (
        round(food_wasted_kg / food_prepared_kg * 100, 2)
        if food_prepared_kg > 0
        else 0
    )

    return jsonify({
        "expected_students": 742,
        "students_served": students_served,
        "food_prepared_kg": food_prepared_kg,
        "food_consumed_kg": food_consumed_kg,
        "food_wasted_kg": food_wasted_kg,
        "waste_percent": waste_percent
    })


@app.route("/api/db-test")
def db_test():
    try:
        client.admin.command("ping")
        return jsonify({
            "message": "MongoDB connected successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/meals", methods=["POST"])
def add_meal():
    data = request.get_json(silent=True) or {}

    day_of_week = data.get("day_of_week")
    meal_type = data.get("meal_type")
    menu = str(data.get("menu", "")).strip()

    if day_of_week not in DAYS:
        return jsonify({"error": "Please choose a valid day of the week"}), 400

    if meal_type not in MEAL_TYPES:
        return jsonify({"error": "Please choose a valid meal type"}), 400

    if not menu:
        return jsonify({"error": "Menu is required"}), 400

    try:
        students_served = int(data.get("students_served"))
        food_prepared_kg = float(data.get("food_prepared_kg"))
        food_consumed_kg = float(data.get("food_consumed_kg"))
    except (TypeError, ValueError):
        return jsonify({
            "error": "Students served, food prepared and food consumed must be numbers"
        }), 400

    if min(students_served, food_prepared_kg, food_consumed_kg) < 0:
        return jsonify({"error": "Values cannot be negative"}), 400

    if food_consumed_kg > food_prepared_kg:
        return jsonify({
            "error": "Food consumed cannot exceed food prepared"
        }), 400

    # Calculated on the server so the stored data is always consistent
    food_wasted_kg = round(food_prepared_kg - food_consumed_kg, 2)
    waste_percent = (
        round(food_wasted_kg / food_prepared_kg * 100, 2)
        if food_prepared_kg > 0
        else 0.0
    )
    is_weekend = 1 if day_of_week in WEEKEND_DAYS else 0

    meal = {
        "day_of_week": day_of_week,
        "meal_type": meal_type,
        "menu": menu,
        "students_served": students_served,
        "food_prepared_kg": round(food_prepared_kg, 2),
        "food_consumed_kg": round(food_consumed_kg, 2),
        "food_wasted_kg": food_wasted_kg,
        "waste_percent": waste_percent,
        "is_weekend": is_weekend,
        "created_at": datetime.now()
    }

    result = meals.insert_one(meal)

    return jsonify({
        "message": "Meal record saved",
        "id": str(result.inserted_id)
    }), 201


@app.route("/api/meals", methods=["GET"])
def get_meals():
    records = list(
        meals.find().sort("created_at", -1).limit(20)
    )

    for record in records:
        record["_id"] = str(record["_id"])

    return jsonify(records)


@app.route("/api/menus")
def get_menus():
    return jsonify({"menus": KNOWN_MENUS})


@app.route("/api/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Prediction model is not available"}), 503

    data = request.get_json(silent=True) or {}

    day_of_week = data.get("day_of_week")
    meal_type = data.get("meal_type")
    menu = str(data.get("menu", "")).strip()

    if day_of_week not in DAYS:
        return jsonify({"error": "Please choose a valid day of the week"}), 400

    if meal_type not in MEAL_TYPES:
        return jsonify({"error": "Please choose a valid meal type"}), 400

    if not menu:
        return jsonify({"error": "Menu is required"}), 400

    # Match the menu to a name the model knows (ignores case and spacing)
    if MENU_LOOKUP:
        known = MENU_LOOKUP.get(menu.lower())
        if known is None:
            return jsonify({
                "error": f"The model doesn't know the menu '{menu}'. Please pick one from the list."
            }), 400
        menu = known

    is_weekend = 1 if day_of_week in WEEKEND_DAYS else 0

    row = pd.DataFrame([{
        "day_of_week": day_of_week,
        "meal_type": meal_type,
        "menu": menu,
        "is_weekend": is_weekend,
    }])

    try:
        predicted_kg = float(model.predict(row)[0])
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {e}"}), 500

    return jsonify({
        "day_of_week": day_of_week,
        "meal_type": meal_type,
        "menu": menu,
        "predicted_kg": round(predicted_kg, 1)
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))