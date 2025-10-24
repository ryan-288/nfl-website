# 4th Down Decision Tool - Frontend + API

A modern web application for making data-driven 4th down decisions in American football.

## Features

- **Modern Web Interface**: Clean, responsive design with real-time calculations
- **Interactive Charts**: Visual representation of decision probabilities
- **Real-time Updates**: Calculations update as you change inputs
- **ML-Powered**: Uses pre-trained machine learning models for accurate predictions
- **Three Decision Options**: Go for it, Field Goal, and Punt analysis

## Quick Start

### Option 1: Run Everything Together (Recommended)
```bash
# Install dependencies
pip install flask flask-cors pandas numpy scikit-learn xgboost joblib scipy

# Run the complete application
python server.py
```

This will:
- Start the Flask API server on port 5000
- Start the static file server on port 8000
- Automatically open your browser to http://localhost:8000

### Option 2: Run Separately

**Terminal 1 - API Server:**
```bash
python api.py
```

**Terminal 2 - Static Server:**
```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## How to Use

1. **Input Game Situation**:
   - Current Yardline (1-99)
   - Yards To Go (1-99)
   - Time Remaining (MM:SS format)
   - Score Differential (3rd/4th down)
   - Kicker Range (20-70 yards)
   - Punter Range (30-80 yards)

2. **View Analysis**:
   - Three decision sections show probability changes
   - Interactive charts display success/failure rates
   - Final recommendation with WPA and win probability

3. **Get Recommendation**:
   - Clear recommendation (Go/FG/Punt)
   - Expected Win Probability Added (WPA)
   - Change in win probability

## File Structure

```
├── index.html          # Main HTML interface
├── style.css           # Modern CSS styling
├── script.js           # JavaScript logic and API calls
├── api.py              # Flask API server
├── server.py           # Combined server script
├── *.pkl               # Pre-trained ML models
├── *.csv               # Data files for calculations
└── README_FRONTEND.md  # This file
```

## API Endpoints

- `POST /api/calculate` - Calculate 4th down decision
- `GET /api/health` - Health check

## Technology Stack

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Chart.js for visualizations
- Modern responsive design

**Backend:**
- Python Flask API
- scikit-learn, XGBoost for ML models
- pandas, numpy for data processing
- scipy for interpolation

## Troubleshooting

**If the API doesn't load:**
- Make sure all `.pkl` and `.csv` files are in the same directory
- Check that Flask and dependencies are installed
- Verify port 5000 is not in use

**If the frontend doesn't connect:**
- Check browser console for errors
- Ensure API server is running on port 5000
- Try refreshing the page

**If models fail to load:**
- Verify all required files are present:
  - `go_for_it_model.pkl`
  - `epa_model_success.pkl`
  - `wpa_model_success.pkl`
  - `fail_epa_wpa_averages.csv`
  - `punt_summary.csv`
  - `scoreprobability.csv`

## Development

To modify the interface:
1. Edit `index.html` for structure
2. Edit `style.css` for styling
3. Edit `script.js` for functionality
4. Edit `api.py` for backend logic

The application will automatically fall back to mock data if the API is unavailable, making development easier.
