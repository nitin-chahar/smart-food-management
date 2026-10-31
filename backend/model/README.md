# Deployed model

The API (`backend/app.py`) loads **one** model from this folder and uses it for the
"Recommended Food to Prepare" panel on the website.

| File | What it is |
|---|---|
| `model.joblib` | The trained model (a full scikit-learn pipeline). **Fixed name**: `app.py` always loads this file. |
| `menus_by_meal.json` | The 10 menus served at Breakfast, Lunch and Dinner. Used by the dropdowns and to validate input. |
| `model_info.json` | Exact details of the file currently deployed (model name, scores, data, library versions). Written automatically by the notebook. |

Because the file name never changes, switching to a different model needs **no code change**
(see [Changing the model](#changing-the-model)).

## What the model does

Predicts **how many kg of food to prepare** (`amount_of_food_required_kg`) for one meal.

| | |
|---|---|
| Inputs | `day_of_week`, `meal_type`, `menu`, `is_weekend` |
| Output | kg of food required for that meal |
| Input format | Plain text and numbers, for example `"Wednesday"`, `"Breakfast"`, `"Idli, sambar, coconut chutney"`, `0`. The pipeline does its own encoding. |

The API works out `is_weekend` from the day (Saturday and Sunday = 1) and only accepts
menus that belong to the chosen meal.

### Adjusting for enrollment

The model has **no student-count input**, so it assumes the enrollment of the period it
was trained on. The API scales its answer:

```
predicted kg = model kg x (enrolled students / TRAINING_STUDENTS)
```

* `TRAINING_STUDENTS` is an approximate baseline (default **742**). Override it with an
  environment variable of the same name on the server.
* Enrolled students is set from the website (navbar button) and stored in MongoDB.

## Currently deployed: K-Nearest Neighbours (KNN) regressor

* Looks up the 7 most similar past meals and averages their food amounts, giving more
  weight to closer matches (`n_neighbors=7`, `weights="distance"`, `p=2`).
* Preprocessing (inside the pipeline):
  * `day_of_week`, `meal_type`, `menu`: fill missing values with the most frequent value, then one-hot encode (unknown values are ignored).
  * `is_weekend`: fill missing values with the median, then standardise.

## Training data

* File: `ml/data/mess_food_dataset.csv`, 10,000 rows, columns `day_of_week`, `meal_type`, `menu`, `is_weekend`, `amount_of_food_required_kg`.
* 7 days x 30 menus (10 per meal type), amounts from about 127 to 494 kg.
* Split: 80% train (8,000 rows) / 20% test (2,000 rows), `random_state=42`.
* The data has **no student-count column**, and it looks generated rather than recorded
  (meal types and weekdays are almost perfectly balanced).

## Accuracy

Measured on the 2,000 held-out test rows. Sorted best first.

| Model | MAE (kg) | R2 | "Accuracy" % |
|---|---|---|---|
| Gradient Boosting | 23.391 | 0.894 | 92.55 |
| Ridge | 23.601 | 0.892 | 92.49 |
| Lasso | 23.605 | 0.892 | 92.49 |
| Linear Regression | 23.605 | 0.892 | 92.49 |
| Random Forest | 23.689 | 0.891 | 92.46 |
| SVR | 24.050 | 0.888 | 92.34 |
| **KNN (deployed)** | **24.577** | **0.881** | **92.18** |

What the columns mean:

* **MAE**: on average the prediction is off by this many kg.
* **R2**: share of the variation in food amount the model explains (1.0 = perfect).
* **"Accuracy" %**: `(1 - MAE / average actual amount) x 100`. This is a relative-error
  score, **not** classification accuracy.

These are the scores from the original training run. After you retrain, the exact scores for
the file that is deployed are in `model_info.json`. KNN's score can shift by a few tenths of
a kg between scikit-learn versions.

### How to read these results

* All seven models land within about 1.2 kg of each other. The differences are small.
* There are only **210 distinct input combinations** (7 days x 30 menus), about 48 rows
  each. Simply predicting the average for each combination (no machine learning) gives
  MAE 23.69 kg and R2 0.891, the same as the better models. So the models have learned
  those averages, and the remaining ~23 kg error is variation the four inputs cannot
  explain (probably things like daily attendance, which the data does not contain).
* Gradient Boosting scores best, KNN is the lowest of the seven. KNN was kept because it
  is simple to explain; switching is a one-word change (below).
* The most promising way to improve accuracy is to add the number of students as an input
  and retrain on data that includes it.

## Limitations

* A KNN model can only return values near amounts it has seen (about 127 to 494 kg here), so it cannot extrapolate to a much larger or smaller mess.
* The enrollment adjustment is a proportional approximation, not something the model learned.
* Menus not in the training data are not supported; the website only offers known menus.
* The training data appears to be synthetic, so these scores describe the data, not real-world performance.

## Changing the model

1. Put `mess_food_dataset.csv` in `ml/data/` (add new data and rows here when you retrain).
2. Open `ml/notebooks/model.ipynb` and run all cells. Every model is saved in `ml/models/`
   and compared in `ml/models/model_comparison.csv`.
3. In section 5, set `DEPLOY_MODEL` to the model you want (for example `"Gradient_Boosting"`) and run the last three cells. This overwrites `model.joblib`, `menus_by_meal.json` and `model_info.json` in this folder.
4. Commit `backend/model/` and push. The server redeploys with the new model. `app.py` is not touched.
5. Check `/api/menus` and try a prediction on the website.

Keep the library versions the same when training and serving: `ml/requirements.txt` includes
`backend/requirements.txt` for exactly this reason, and `model_info.json` records the
versions used. If the server fails to load the model, compare those versions first.

## Server settings (optional)

| Variable | Purpose | Default |
|---|---|---|
| `MODEL_PATH` | Load the model from a different path | `backend/model/model.joblib` |
| `MENUS_PATH` | Load the menu list from a different path | `backend/model/menus_by_meal.json` |
| `TRAINING_STUDENTS` | Enrollment the model is assumed to represent | `742` |