from datetime import datetime
from pathlib import Path
import json
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


def load_menus_by_meal():
    """Menus served at each meal, taken from the training data (menus_by_meal.json)."""
    base = Path(__file__).resolve().parent
    candidates = [
        os.getenv("MENUS_PATH"),
        base / "model" / "menus_by_meal.json",
        base.parent / "model" / "menus_by_meal.json",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            try:
                with open(candidate, encoding="utf-8") as f:
                    data = json.load(f)
                return {meal: [str(x) for x in data.get(meal, [])] for meal in MEAL_TYPES}
            except Exception as e:
                print(f"Could not read menus from {candidate}: {e}")
                return {}
    print("Warning: menus_by_meal.json not found, menus will not be filtered by meal")
    return {}


MENUS_BY_MEAL = load_menus_by_meal()
ALL_MENUS = sorted(set(KNOWN_MENUS) | {m for items in MENUS_BY_MEAL.values() for m in items})
ALL_MENU_LOOKUP = {name.lower(): name for name in ALL_MENUS}

# ---- Enrollment settings ----
# The model has no student-count input, so predictions are scaled by
# (enrolled students / TRAINING_STUDENTS). TRAINING_STUDENTS is an approximate
# baseline; override it with an environment variable on Render.
try:
    TRAINING_STUDENTS = int(os.getenv("TRAINING_STUDENTS", "742"))
    if TRAINING_STUDENTS < 1:
        raise ValueError
except ValueError:
    TRAINING_STUDENTS = 742

DEFAULT_ENROLLED_STUDENTS = 742
settings_col = db["settings"]


def get_enrolled_students():
    """Enrollment saved from the website (kept in MongoDB until changed)."""
    try:
        doc = settings_col.find_one({"_id": "enrollment"})
        if doc and doc.get("enrolled_students"):
            return int(doc["enrolled_students"])
    except Exception as e:
        print(f"Could not read enrollment setting: {e}")
    return DEFAULT_ENROLLED_STUDENTS


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
        "expected_students": get_enrolled_students(),
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

    # Use the exact spelling from the training data when the menu is known
    menu = ALL_MENU_LOOKUP.get(menu.lower(), menu)

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
    return jsonify({"menus": ALL_MENUS, "by_meal": MENUS_BY_MEAL})


@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify({
        "enrolled_students": get_enrolled_students(),
        "training_students": TRAINING_STUDENTS
    })


@app.route("/api/settings", methods=["POST"])
def update_settings():
    data = request.get_json(silent=True) or {}

    try:
        enrolled_students = int(data.get("enrolled_students"))
    except (TypeError, ValueError):
        return jsonify({"error": "Enrolled students must be a whole number"}), 400

    if enrolled_students < 1 or enrolled_students > 100000:
        return jsonify({
            "error": "Enrolled students must be between 1 and 100000"
        }), 400

    settings_col.update_one(
        {"_id": "enrollment"},
        {"$set": {
            "enrolled_students": enrolled_students,
            "updated_at": datetime.now()
        }},
        upsert=True
    )

    return jsonify({
        "enrolled_students": enrolled_students,
        "training_students": TRAINING_STUDENTS
    })


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

    # The menu must be one served at this meal (ignores case and spacing)
    valid_menus = MENUS_BY_MEAL.get(meal_type) or ALL_MENUS
    if valid_menus:
        lookup = {name.lower(): name for name in valid_menus}
        known = lookup.get(menu.lower())
        if known is None:
            return jsonify({
                "error": f"'{menu}' is not a known {meal_type} menu. Please pick one from the list."
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

    # Scale from the enrollment the model assumes to the current enrollment
    enrolled_students = get_enrolled_students()
    scale_factor = enrolled_students / TRAINING_STUDENTS

    return jsonify({
        "day_of_week": day_of_week,
        "meal_type": meal_type,
        "menu": menu,
        "model_kg": round(predicted_kg, 1),
        "predicted_kg": round(predicted_kg * scale_factor, 1),
        "scale_factor": round(scale_factor, 3),
        "enrolled_students": enrolled_students,
        "training_students": TRAINING_STUDENTS
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))