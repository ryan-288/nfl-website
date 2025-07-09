# NFL Decision Calculator

A web-based tool that calculates optimal 4th down decisions using real NFL data and machine learning models. The calculator provides Win Probability Added (WPA) analysis for going for it, field goals, and punts.

## Features

- **Real NFL Data**: Uses actual NFL statistics and machine learning models
- **Three Decision Options**: 
  - Go for it (4th down conversion)
  - Field goal attempt
  - Punt
- **Dynamic Calculations**: Considers field position, time remaining, score difference, quarter, and player ranges
- **Visual Results**: Pie charts and detailed probability breakdowns
- **Responsive Design**: Works on desktop and mobile devices

## Game Parameters

- **Field Position**: Own side vs opponent side
- **Yardline**: Current field position (1-50 yards)
- **Yards to Go**: Distance needed for first down (1-20 yards)
- **Time Remaining**: Game clock remaining
- **Score Difference**: Points ahead/behind
- **Quarter**: 1st, 2nd, 3rd, or 4th quarter
- **Kicker Range**: Maximum reliable field goal distance
- **Punter Range**: Average punt distance

## Technology Stack

- **Backend**: Python Flask
- **Frontend**: HTML, CSS (Tailwind), JavaScript
- **Machine Learning**: scikit-learn models
- **Data**: Real NFL statistics and probability models

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nfl-decision-calculator.git
cd nfl-decision-calculator
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python app.py
```

4. Open your browser and navigate to `http://localhost:5000`

## API Endpoints

- `GET /`: Main web interface
- `POST /api/calculate`: Calculate decision probabilities

### API Request Format
```json
{
  "yardline": 50,
  "yardsToGo": 10,
  "quarter": "4th",
  "timeRemaining": "15:00",
  "scoreDiff": 1,
  "kickerRange": 50,
  "punterRange": 45,
  "fieldPosition": "own"
}
```

## Data Sources

The calculator uses:
- Real NFL play-by-play data
- Machine learning models trained on historical NFL decisions
- Field goal success rates by distance
- Punt distance and return statistics
- Win probability models

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- NFL play-by-play data
- Advanced Football Analytics community
- scikit-learn machine learning library
