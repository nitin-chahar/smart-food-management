from datetime import datetime
import os
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

    food_prepared = sum(
        record.get("food_prepared", 0) for record in records
    )

    meals_served = sum(
        record.get("meals_served", 0) for record in records
    )

    food_waste = sum(
        record.get("food_waste", 0) for record in records
    )

    return jsonify({
        "expected_students": 742,
        "meals_served": meals_served,
        "food_prepared": food_prepared,
        "food_waste": food_waste
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

    data = request.get_json()

    meal = {
        "meal_type": data["meal_type"],
        "food_prepared": data["food_prepared"],
        "meals_served": data["meals_served"],
        "food_waste": data["food_waste"],
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

if __name__ == "__main__":
    app.run(debug=True, port=5000)