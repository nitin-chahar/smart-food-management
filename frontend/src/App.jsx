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
      setMenu('')
      setStudentsServed('')
      setFoodPrepared('')
      setFoodConsumed('')
      loadSummary()
      loadMeals()
    } catch (error) {
      setMessage(error.message || 'Could not connect to backend')
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
          <a href="#add-meal">Add Meal</a>
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
            <a href="#add-meal" className="btn">
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

        {/* ---------- Add meal ---------- */}
        <section className="section" id="add-meal">
          <h2 className="section-title">Add Meal Record</h2>

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
                onChange={(e) => setMealType(e.target.value)}
              >
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
              </select>
            </label>

            <label className="field-wide">
              Menu
              <input
                type="text"
                required
                list="menu-options"
                placeholder="e.g. Idli"
                value={menu}
                onChange={(e) => setMenu(e.target.value)}
              />
              <datalist id="menu-options">
                {menuOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
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
                          ? new Date(meal.created_at).toLocaleString()
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
    </div>
  )
}

export default App