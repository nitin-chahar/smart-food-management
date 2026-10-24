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

function App() {
  const [summary, setSummary] = useState(null)
  const [mealType, setMealType] = useState('Lunch')
  const [foodPrepared, setFoodPrepared] = useState('')
  const [mealsServed, setMealsServed] = useState('')
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
      ? { prepared: '#7cc4cd', served: '#3f8f9a', waste: '#ff8a7a' }
      : { prepared: '#2b5f66', served: '#8cc5cc', waste: '#d65a4a' }

  const foodWaste = Math.max(
    0,
    Number(foodPrepared || 0) - Number(mealsServed || 0)
  )

  const chartData = [
    {
      name: 'Breakfast',
      Prepared: 0,
      Served: 0,
      Waste: 0,
    },
    {
      name: 'Lunch',
      Prepared: 0,
      Served: 0,
      Waste: 0,
    },
    {
      name: 'Dinner',
      Prepared: 0,
      Served: 0,
      Waste: 0,
    },
  ]

  meals.forEach((meal) => {
    const item = chartData.find(
      (data) => data.name === meal.meal_type
    )

    if (item) {
      item.Prepared += meal.food_prepared
      item.Served += meal.meals_served
      item.Waste += meal.food_waste
    }
  })

  const loadSummary = () => {
    fetch('https://smartmess-api.onrender.com/api/summary')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load dashboard data')
        return res.json()
      })
      .then((data) => setSummary(data))
      .catch(() => setMessage('Could not load dashboard data'))
  }

  const loadMeals = () => {
    fetch('https://smartmess-api.onrender.com/api/meals')
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

    if (Number(mealsServed) > Number(foodPrepared)) {
      setMessage('Meals served cannot exceed food prepared.')
      return
    }

    try {
      const response = await fetch(
        'https://smartmess-api.onrender.com/api/meals',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meal_type: mealType,
            food_prepared: Number(foodPrepared),
            meals_served: Number(mealsServed),
            food_waste: foodWaste,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not save meal')
      }

      setMessage('Meal saved successfully!')
      setFoodPrepared('')
      setMealsServed('')
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
              Live data from your database. Track what you prepare, what you
              serve, and what goes to waste.
            </p>
            <a href="#add-meal" className="btn">
              Add Meal Record
            </a>
          </div>

          <div className="hero-visual">
            <div className="plate">
              <div className="plate-inner">
                <span>Food Waste</span>
                <strong>{summary ? summary.food_waste : '—'}</strong>
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
                  <h3>{summary.expected_students}</h3>
                </div>
                <p>Expected Students</p>
              </article>
              <article className="card">
                <div className="card-tile">
                  <h3>{summary.meals_served}</h3>
                </div>
                <p>Meals Served</p>
              </article>
              <article className="card">
                <div className="card-tile">
                  <h3>{summary.food_prepared}</h3>
                </div>
                <p>Food Prepared</p>
              </article>
              <article className="card">
                <div className="card-tile">
                  <h3>{summary.food_waste}</h3>
                </div>
                <p>Food Waste</p>
              </article>
            </div>
          )}
        </section>

        {/* ---------- Add meal ---------- */}
        <section className="section" id="add-meal">
          <h2 className="section-title">Add Meal Record</h2>

          <form className="form" onSubmit={saveMeal}>
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

            <label>
              Food Prepared (portions)
              <input
                type="number"
                min="0"
                required
                value={foodPrepared}
                onChange={(e) => setFoodPrepared(e.target.value)}
              />
            </label>

            <label>
              Meals Served (portions)
              <input
                type="number"
                min="0"
                required
                value={mealsServed}
                onChange={(e) => setMealsServed(e.target.value)}
              />
            </label>

            <label>
              Food Waste (portions)
              <input
                type="number"
                value={foodWaste}
                readOnly
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
            Compare prepared food, meals served, and food waste.
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
                <Bar dataKey="Served" fill={chartColors.served} radius={[4, 4, 0, 0]} />
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
                  <th>Meal Type</th>
                  <th>Prepared</th>
                  <th>Served</th>
                  <th>Waste</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {meals.length > 0 ? (
                  meals.map((meal) => (
                    <tr key={meal._id}>
                      <td>{meal.meal_type}</td>
                      <td>{meal.food_prepared}</td>
                      <td>{meal.meals_served}</td>
                      <td>{meal.food_waste}</td>
                      <td>
                        {meal.created_at
                          ? new Date(meal.created_at).toLocaleString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">No meal records found.</td>
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