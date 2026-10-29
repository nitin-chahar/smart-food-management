import { useEffect, useState } from 'react'
import './App.css'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

// Deployed backend (Render)
const API_URL = 'https://smartmess-api.onrender.com'

// Shows "—" for old records that don't have the new fields
const fmt = (n) =>
  n === undefined || n === null
    ? '—'
    : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })

function App() {
  const [summary, setSummary] = useState(null)
  const [dayOfWeek, setDayOfWeek] = useState(
    new Date().toLocaleDateString('en-US', { weekday: 'long' })
  )
  const [mealType, setMealType] = useState('Lunch')
  const [menu, setMenu] = useState('')
  const [studentsServed, setStudentsServed] = useState('')
  const [foodPrepared, setFoodPrepared] = useState('')
  const [foodConsumed, setFoodConsumed] = useState('')
  const [message, setMessage] = useState('')
  const [meals, setMeals] = useState([])

  // Which tool is shown: 'predict' (default) or 'record'
  const [mode, setMode] = useState('predict')

  // Prediction panel
  const [predDay, setPredDay] = useState(
    new Date().toLocaleDateString('en-US', { weekday: 'long' })
  )
  const [predMeal, setPredMeal] = useState('Lunch')
  const [predMenu, setPredMenu] = useState('')
  const [menus, setMenus] = useState([])
  const [menusByMeal, setMenusByMeal] = useState({})

  // Enrollment setting (saved on the server until changed)
  const [settings, setSettings] = useState({
    enrolled_students: null,
    training_students: null,
  })
  const [enrolledInput, setEnrolledInput] = useState('')
  const [enrollMessage, setEnrollMessage] = useState('')
  const [showEnroll, setShowEnroll] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [predictError, setPredictError] = useState('')
  const [predicting, setPredicting] = useState(false)

  // Light / dark theme (UI only, remembered in the browser)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      /* ignore */
    }
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const chartColors =
    theme === 'dark'
      ? { prepared: '#7cc4cd', consumed: '#3f8f9a', waste: '#ff8a7a' }
      : { prepared: '#2b5f66', consumed: '#8cc5cc', waste: '#d65a4a' }

  // Past menus, offered as suggestions so spelling stays consistent
  const menuOptions = [...new Set(meals.map((m) => m.menu).filter(Boolean))]

  // Menus served at the selected meal (falls back to the full list)
  const recordMenus = menusByMeal[mealType] || menus
  const predictMenus = menusByMeal[predMeal] || menus

  const chartData = [
    {
      name: 'Breakfast',
      Prepared: 0,
      Consumed: 0,
      Waste: 0,
    },
    {
      name: 'Lunch',
      Prepared: 0,
      Consumed: 0,
      Waste: 0,
    },
    {
      name: 'Dinner',
      Prepared: 0,
      Consumed: 0,
      Waste: 0,
    },
  ]

  meals.forEach((meal) => {
    const item = chartData.find(
      (data) => data.name === meal.meal_type
    )

    if (item) {
      item.Prepared += meal.food_prepared_kg || 0
      item.Consumed += meal.food_consumed_kg || 0
      item.Waste += meal.food_wasted_kg || 0
    }
  })

  const loadSummary = () => {
    fetch(`${API_URL}/api/summary`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not load dashboard data')
        return res.json()
      })
      .then((data) => setSummary(data))
      .catch(() => setMessage('Could not load dashboard data'))
  }

  const loadMeals = () => {
    fetch(`${API_URL}/api/meals`)
      .then((res) => res.json())
      .then((data) => setMeals(data))
      .catch(() => setMessage('Could not load meal history'))
  }

  useEffect(() => {
    loadSummary()
    loadMeals()
  }, [])

  const saveMeal = async (e) => {
    e.preventDefault()
    setMessage('')

    if (Number(foodConsumed) > Number(foodPrepared)) {
      setMessage('Food consumed cannot exceed food prepared.')
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: dayOfWeek,
          meal_type: mealType,
          menu: menu.trim(),
          students_served: Number(studentsServed),
          food_prepared_kg: Number(foodPrepared),
          food_consumed_kg: Number(foodConsumed),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not save meal')
      }

      setMessage('Meal saved successfully!')
      setStudentsServed('')
      setFoodPrepared('')
      setFoodConsumed('')
      loadSummary()
      loadMeals()
    } catch (error) {
      setMessage(error.message || 'Could not connect to backend')
    }
  }

  // Menus the model knows, grouped by meal (both forms use the same names)
  useEffect(() => {
    fetch(`${API_URL}/api/menus`)
      .then((res) => res.json())
      .then((data) => {
        const flat = data.menus || []
        const byMeal = data.by_meal || {}
        setMenus(flat)
        setMenusByMeal(byMeal)
        // Both forms start on Lunch
        const first = (byMeal.Lunch || flat)[0] || ''
        setPredMenu(first)
        setMenu(first)
      })
      .catch(() => {})
  }, [])

  const changeRecordMeal = (value) => {
    setMealType(value)
    const options = menusByMeal[value] || menus
    if (options.length > 0) setMenu(options[0])
  }

  const changePredictMeal = (value) => {
    setPredMeal(value)
    setPrediction(null)
    const options = menusByMeal[value] || menus
    if (options.length > 0) setPredMenu(options[0])
  }

  // Enrolled students (kept on the server until you change it)
  const loadSettings = () => {
    fetch(`${API_URL}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        setSettings(data)
        setEnrolledInput(String(data.enrolled_students))
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const openEnroll = () => {
    setEnrolledInput(String(settings.enrolled_students ?? ''))
    setEnrollMessage('')
    setShowEnroll(true)
  }

  const closeEnroll = () => setShowEnroll(false)

  useEffect(() => {
    if (!showEnroll) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setShowEnroll(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [showEnroll])

  const saveEnrollment = async (e) => {
    e.preventDefault()
    setEnrollMessage('')

    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrolled_students: Number(enrolledInput) }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not update enrollment')
      }

      setSettings(data)
      setEnrolledInput(String(data.enrolled_students))
      setPrediction(null)
      setShowEnroll(false)
      loadSummary()
    } catch (error) {
      setEnrollMessage(error.message || 'Could not connect to backend')
    }
  }

  const predictFood = async (e) => {
    e.preventDefault()
    setPrediction(null)
    setPredictError('')
    setPredicting(true)

    try {
      const response = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: predDay,
          meal_type: predMeal,
          menu: predMenu.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not get a prediction')
      }

      setPrediction(data)
    } catch (error) {
      setPredictError(error.message || 'Could not connect to backend')
    } finally {
      setPredicting(false)
    }
  }

  // Presentation only: picks the message colour
  const messageIsSuccess = message === 'Meal saved successfully!'

  return (
    <div className="app">
      {/* ---------- Top navigation ---------- */}
      <nav className="nav">
        <div className="nav-links">
          <a href="#overview">Overview</a>
          <a href="#meal-tools" onClick={() => setMode('predict')}>
            Predict
          </a>
          <a href="#meal-tools" onClick={() => setMode('record')}>
            Add Meal
          </a>
          <a href="#analytics">Analytics</a>
          <a href="#history">History</a>
        </div>

        <a href="#overview" className="brand" aria-label="SmartMess home">
          <svg
            className="brand-mark"
            viewBox="0 0 32 32"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="16" cy="16" r="12" />
            <circle cx="16" cy="16" r="6" />
          </svg>
          <span>SmartMess</span>
        </a>

        <div className="nav-right">
          <button
            type="button"
            className="enroll-btn"
            onClick={openEnroll}
            title="Change enrolled students"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
              <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4c1.9.7 3 2.5 3 5.6" />
            </svg>
            <span>
              Enrolled: <strong>{fmt(settings.enrolled_students)}</strong>
            </span>
          </button>
          <span className="status">Admin Dashboard</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="hero" id="overview">
          <div className="hero-copy">
            <p className="hero-kicker">Food Demand &amp; Waste Management</p>
            <h1>
              Serve
              <br />
              Every Plate
              <br />
              With Purpose
            </h1>
            <p className="hero-text">
              Live data from your database. Track what you prepare, what
              students consume, and what goes to waste.
            </p>
            <a
              href="#meal-tools"
              className="btn"
              onClick={() => setMode('record')}
            >
              Add Meal Record
            </a>
          </div>

          <div className="hero-visual">
            <div className="plate">
              <div className="plate-inner">
                <span>Food Waste (kg)</span>
                <strong>{summary ? fmt(summary.food_wasted_kg) : '—'}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Summary ---------- */}
        <section className="section">
          <h2 className="section-title">Meal Overview</h2>

          {summary && (
            <div className="stats">
              <article className="card">
                <div className="card-tile">
                  <h3>{fmt(summary.expected_students)}</h3>
                </div>
                <p>Expected Students</p>
              </article>
              <article className="card">
                <div className="card-tile">
                  <h3>{fmt(summary.students_served)}</h3>
                </div>
                <p>Students Served</p>
              </article>
              <article className="card">
                <div className="card-tile">
                  <h3>{fmt(summary.food_prepared_kg)}</h3>
                </div>
                <p>Food Prepared (kg)</p>
              </article>
              <article className="card">
                <div className="card-tile">
                  <h3>{fmt(summary.food_wasted_kg)}</h3>
                </div>
                <p>Food Wasted (kg)</p>
              </article>
            </div>
          )}
        </section>

        {/* ---------- Prediction ---------- */}
        <section className="section" id="meal-tools">
          <h2 className="section-title">
            {mode === 'predict' ? 'Recommended Food to Prepare' : 'Add Meal Record'}
          </h2>
          <p className="section-sub">
            {mode === 'predict'
              ? 'Pick a day, meal and menu to see how much food to cook.'
              : 'Save what was prepared and consumed to keep your data up to date.'}
          </p>

          <div className="mode-switch" role="tablist" aria-label="Choose an action">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'predict'}
              className={mode === 'predict' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setMode('predict')}
            >
              Predict Food
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'record'}
              className={mode === 'record' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setMode('record')}
            >
              Add Meal Record
            </button>
          </div>

          {mode === 'predict' && (
          <>
          <form className="form" onSubmit={predictFood}>
            <label>
              Day of Week
              <select
                value={predDay}
                onChange={(e) => setPredDay(e.target.value)}
              >
                {DAYS.map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
            </label>

            <label>
              Meal Type
              <select
                value={predMeal}
                onChange={(e) => changePredictMeal(e.target.value)}
              >
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
              </select>
            </label>

            <label className="field-wide">
              Menu
              {predictMenus.length > 0 ? (
                <select
                  value={predMenu}
                  onChange={(e) => setPredMenu(e.target.value)}
                >
                  {predictMenus.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="e.g. Idli"
                  value={predMenu}
                  onChange={(e) => setPredMenu(e.target.value)}
                />
              )}
            </label>

            <div className="form-actions">
              <button type="submit" className="btn" disabled={predicting}>
                {predicting ? 'Predicting…' : 'Predict'}
              </button>
              {predictError && (
                <p className="message message-error" role="status">
                  {predictError}
                </p>
              )}
            </div>
          </form>

          {prediction && (
            <div className="prediction" role="status">
              <p>Recommended to prepare</p>
              <h3>{fmt(prediction.predicted_kg)} kg</h3>
              <span>
                {prediction.day_of_week} · {prediction.meal_type} ·{' '}
                {prediction.menu}
              </span>
              {prediction.scale_factor !== 1 && (
                <p className="prediction-note">
                  Model estimate {fmt(prediction.model_kg)} kg, adjusted for{' '}
                  {fmt(prediction.enrolled_students)} enrolled students (model
                  baseline: {fmt(prediction.training_students)}).
                </p>
              )}
            </div>
          )}
          </>
          )}

          {mode === 'record' && (
          <form className="form" onSubmit={saveMeal}>
            <label>
              Day of Week
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
              >
                {DAYS.map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
            </label>

            <label>
              Meal Type
              <select
                value={mealType}
                onChange={(e) => changeRecordMeal(e.target.value)}
              >
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
              </select>
            </label>

            <label className="field-wide">
              Menu
              {recordMenus.length > 0 ? (
                <select
                  required
                  value={menu}
                  onChange={(e) => setMenu(e.target.value)}
                >
                  {recordMenus.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    required
                    list="menu-options"
                    placeholder="e.g. Idli, sambar, coconut chutney"
                    value={menu}
                    onChange={(e) => setMenu(e.target.value)}
                  />
                  <datalist id="menu-options">
                    {menuOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </>
              )}
            </label>

            <label>
              Students Served
              <input
                type="number"
                min="0"
                step="1"
                required
                value={studentsServed}
                onChange={(e) => setStudentsServed(e.target.value)}
              />
            </label>

            <label>
              Food Prepared (kg)
              <input
                type="number"
                min="0"
                step="any"
                required
                value={foodPrepared}
                onChange={(e) => setFoodPrepared(e.target.value)}
              />
            </label>

            <label>
              Food Consumed (kg)
              <input
                type="number"
                min="0"
                step="any"
                required
                value={foodConsumed}
                onChange={(e) => setFoodConsumed(e.target.value)}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn">
                Save Meal
              </button>
              {message && (
                <p
                  className={
                    messageIsSuccess ? 'message message-ok' : 'message message-error'
                  }
                  role="status"
                >
                  {message}
                </p>
              )}
            </div>
          </form>
          )}
        </section>

        {/* ---------- Analytics ---------- */}
        <section className="section" id="analytics">
          <h2 className="section-title">Food Waste Analytics</h2>
          <p className="section-sub">
            Compare food prepared, food consumed, and food waste (kg).
          </p>

          <div className="chart-box" style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(127,127,127,0.12)' }}
                  contentStyle={{
                    background: 'var(--paper)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    color: 'var(--ink)',
                  }}
                />
                <Legend />
                <Bar dataKey="Prepared" fill={chartColors.prepared} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Consumed" fill={chartColors.consumed} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Waste" fill={chartColors.waste} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ---------- History ---------- */}
        <section className="section" id="history">
          <h2 className="section-title">Meal History</h2>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Meal Type</th>
                  <th>Menu</th>
                  <th>Students</th>
                  <th>Prepared (kg)</th>
                  <th>Consumed (kg)</th>
                  <th>Waste (kg)</th>
                  <th>Waste %</th>
                  <th>Saved On</th>
                </tr>
              </thead>

              <tbody>
                {meals.length > 0 ? (
                  meals.map((meal) => (
                    <tr key={meal._id}>
                      <td>{meal.day_of_week ?? '—'}</td>
                      <td>{meal.meal_type}</td>
                      <td>{meal.menu ?? '—'}</td>
                      <td>{fmt(meal.students_served)}</td>
                      <td>{fmt(meal.food_prepared_kg)}</td>
                      <td>{fmt(meal.food_consumed_kg)}</td>
                      <td>{fmt(meal.food_wasted_kg)}</td>
                      <td>{fmt(meal.waste_percent)}</td>
                      <td>
                        {meal.created_at
                          ? new Date(meal.created_at).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9">No meal records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showEnroll && (
        <div className="modal-backdrop" onClick={closeEnroll}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enroll-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={closeEnroll}
            >
              ×
            </button>
            <h2 id="enroll-title">Enrolled Students</h2>
            <p className="modal-sub">
              Saved until you change it. Predictions are scaled from the
              model&apos;s baseline of {fmt(settings.training_students)} students.
            </p>

            <form onSubmit={saveEnrollment}>
              <label>
                Number of students
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  autoFocus
                  value={enrolledInput}
                  onChange={(e) => setEnrolledInput(e.target.value)}
                />
              </label>

              {enrollMessage && (
                <p className="message message-error" role="status">
                  {enrollMessage}
                </p>
              )}

              <div className="modal-actions">
                <button type="submit" className="btn">
                  Update
                </button>
                <button type="button" className="btn-ghost" onClick={closeEnroll}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App