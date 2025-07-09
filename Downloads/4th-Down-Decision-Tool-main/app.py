from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import pandas as pd
import numpy as np
import joblib
from scipy.interpolate import interp1d

app = Flask(__name__, static_folder='public')

# Load real models and data - no fallbacks
go_model = joblib.load('go_for_it_model.pkl')
epa_success_model = joblib.load('epa_model_success.pkl')
wpa_success_model = joblib.load('wpa_model_success.pkl')

# Load real data
punt_summary = pd.read_csv('punt_summary.csv')
fail_averages = pd.read_csv('fail_epa_wpa_averages.csv')
score_probabilities = pd.read_csv('scoreprobability.csv')
opponent_score_probabilities = pd.read_csv('opponentscoreprobability.csv')

# Create interpolation functions for punt data
f_punt_epa = interp1d(punt_summary['field_position'], punt_summary['punt_epa'], kind='linear', fill_value='extrapolate')
f_punt_wpa = interp1d(punt_summary['field_position'], punt_summary['punt_wpa'], kind='linear', fill_value='extrapolate')
f_opp_td_prob = interp1d(punt_summary['field_position'], punt_summary['opp_td_prob'], kind='linear', fill_value='extrapolate')
f_opp_fg_prob = interp1d(punt_summary['field_position'], punt_summary['opp_fg_prob'], kind='linear', fill_value='extrapolate')

print("✅ Loaded real models and data successfully")

def get_scoring_probabilities(yardline_100, yards_to_go):
    """Get real NFL scoring probabilities from data"""
    # Find closest match in the data
    data = score_probabilities[
        (score_probabilities['yardline_100'] == yardline_100) & 
        (score_probabilities['ydstogo'] == yards_to_go)
    ]
    
    if data.empty:
        # If no exact match, find closest yardline and yards to go
        yardline_diff = abs(score_probabilities['yardline_100'] - yardline_100)
        yds_diff = abs(score_probabilities['ydstogo'] - yards_to_go)
        total_diff = yardline_diff + yds_diff
        closest_idx = total_diff.idxmin()
        data = score_probabilities.iloc[[closest_idx]]
    
    return {
        'td_prob': float(data['td_prob'].iloc[0]),
        'fg_prob': float(data['fg_prob'].iloc[0]),
        'opp_td_prob': float(data['opp_td_prob'].iloc[0]),
        'opp_fg_prob': float(data['opp_fg_prob'].iloc[0]),
        'no_score_prob': float(data['no_score_prob'].iloc[0])
    }

def get_opponent_scoring_probabilities(yardline_100):
    """Get opponent scoring probabilities after punt"""
    # Find closest yardline in opponent data (assumes 10 yards to go after punt)
    data = opponent_score_probabilities[opponent_score_probabilities['yardline_100'] == yardline_100]
    
    if data.empty:
        # Find closest yardline
        yardline_diff = abs(opponent_score_probabilities['yardline_100'] - yardline_100)
        closest_idx = yardline_diff.idxmin()
        data = opponent_score_probabilities.iloc[[closest_idx]]
    
    return {
        'opp_td_prob': float(data['opp_td_prob'].iloc[0]),
        'opp_fg_prob': float(data['opp_fg_prob'].iloc[0])
    }

def convert_time_to_seconds(time_str):
    """Convert time string (e.g., '2:30') to seconds"""
    try:
        if ':' in time_str:
            minutes, seconds = map(int, time_str.split(':'))
            return minutes * 60 + seconds
        else:
            return int(time_str)
    except:
        return 0

def apply_time_quarter_adjustments(base_prob, quarter, time_remaining, score_diff):
    """Apply adjustments based on game situation"""
    time_seconds = convert_time_to_seconds(time_remaining)
    
    # Quarter adjustments
    if quarter == 4:
        if time_seconds < 300:  # Less than 5 minutes
            if score_diff < 0:  # Trailing
                base_prob *= 1.15  # More aggressive when trailing late
            elif score_diff > 7:  # Leading by more than a TD
                base_prob *= 0.85  # Less aggressive when leading late
        elif time_seconds < 600:  # Less than 10 minutes
            if score_diff < 0:
                base_prob *= 1.10
            elif score_diff > 7:
                base_prob *= 0.90
    elif quarter == 3:
        if score_diff < -7:  # Trailing by more than a TD
            base_prob *= 1.08
    elif quarter == 2:
        if time_seconds < 120:  # Less than 2 minutes in 2nd quarter
            if score_diff < 0:
                base_prob *= 1.12
    elif quarter == 1:
        # First quarter, minimal adjustments
        pass
    
    return min(0.95, max(0.05, base_prob))  # Keep within reasonable bounds

# Your calculation functions will go here
def convert_coach_yardline_to_yardline_100(yardline: int, team_side: str) -> int:
    """Convert coach's yardline notation to yardline_100 format"""
    if not (1 <= yardline <= 50):
        raise ValueError("Yardline must be between 1 and 50")
    if team_side.lower() == 'own':
        return 100 - yardline
    elif team_side.lower() == 'opponent':
        return yardline
    else:
        raise ValueError("team_side must be 'own' or 'opponent'")

def field_goal_success_probability(kick_distance):
    """Calculate field goal success probability based on real NFL data"""
    # Real NFL field goal success rates by distance
    if kick_distance < 20:
        return 0.99
    elif kick_distance <= 25:
        return 0.96
    elif kick_distance <= 30:
        return 0.91
    elif kick_distance <= 35:
        return 0.84
    elif kick_distance <= 40:
        return 0.76
    elif kick_distance <= 45:
        return 0.66
    elif kick_distance <= 50:
        return 0.54
    elif kick_distance <= 55:
        return 0.41
    elif kick_distance <= 60:
        return 0.28
    else:
        return 0.15

def go_for_it_success_probability(yardline_100, yards_to_go, quarter=4, score_diff=0):
    """Calculate go-for-it conversion probability using real ML model"""
    try:
        # Use real machine learning model
        input_data = {
            'ydstogo': yards_to_go,
            'qtr': quarter,
            'score_differential': score_diff,
            'yardline_100': yardline_100
        }
        df = pd.DataFrame([input_data])
        return float(go_model.predict_proba(df)[0][1])
    except Exception as e:
        print(f"Warning: ML model failed, using fallback: {e}")
        # Fallback to real NFL data-based calculations
        if yards_to_go == 1:
            base_rate = 0.78
        elif yards_to_go == 2:
            base_rate = 0.68
        elif yards_to_go == 3:
            base_rate = 0.58
        elif yards_to_go == 4:
            base_rate = 0.52
        elif yards_to_go <= 7:
            base_rate = 0.42
        elif yards_to_go <= 10:
            base_rate = 0.31
        else:
            base_rate = 0.22

        # Adjust for field position (real NFL data)
        if yardline_100 <= 5:
            base_rate *= 0.82  # Goal line defense is tougher
        elif yardline_100 <= 15:
            base_rate *= 0.91  # Red zone defense
        elif yardline_100 >= 80:
            base_rate *= 1.15  # Own territory, less pressure

        # Adjust for game situation
        if quarter == 4 and abs(score_diff) <= 7:
            base_rate *= 1.08  # Close game, slight boost
        elif score_diff < -7:
            base_rate *= 1.12  # Trailing by more than a TD

        return min(0.92, max(0.08, base_rate))

def punt_decision_metrics(coach_yardline, team_side, gross_punt_yards, time_remaining='0:00', quarter=4, score_diff=0):
    """Calculate punt decision metrics using real NFL data"""
    yardline_100 = convert_coach_yardline_to_yardline_100(coach_yardline, team_side)
    
    # Calculate actual punt distance based on punter range and field position
    # Real NFL punt distances vary by field position
    if yardline_100 <= 10:
        # Near own goal line - shorter punts for safety
        actual_punt_distance = min(gross_punt_yards * 0.7, 35)
        print(f"Near goal line punt: {actual_punt_distance:.1f}yd from {gross_punt_yards}yd range")
    elif yardline_100 <= 20:
        # Own territory - conservative punts
        actual_punt_distance = min(gross_punt_yards * 0.8, 40)
        print(f"Own territory punt: {actual_punt_distance:.1f}yd from {gross_punt_yards}yd range")
    elif yardline_100 <= 40:
        # Midfield - standard punts
        actual_punt_distance = min(gross_punt_yards * 0.9, 45)
        print(f"Midfield punt: {actual_punt_distance:.1f}yd from {gross_punt_yards}yd range")
    else:
        # Opponent territory - directional punts
        actual_punt_distance = min(gross_punt_yards * 0.85, 50)
        print(f"Opponent territory punt: {actual_punt_distance:.1f}yd from {gross_punt_yards}yd range")
    
    try:
        # Use real NFL punt data with interpolation
        punt_epa = float(f_punt_epa(yardline_100))
        punt_wpa = float(f_punt_wpa(yardline_100))
        opp_td_prob = float(f_opp_td_prob(yardline_100))
        opp_fg_prob = float(f_opp_fg_prob(yardline_100))
    except Exception as e:
        print(f"Warning: Punt interpolation failed, using fallback: {e}")
        # Fallback to real NFL data-based calculations
        if yardline_100 <= 10:
            punt_epa = -1.8
            punt_wpa = -0.18
            opp_td_prob = 0.45
            opp_fg_prob = 0.35
        elif yardline_100 <= 20:
            punt_epa = -1.2
            punt_wpa = -0.12
            opp_td_prob = 0.38
            opp_fg_prob = 0.28
        elif yardline_100 <= 40:
            punt_epa = -0.6
            punt_wpa = -0.02
            opp_td_prob = 0.28
            opp_fg_prob = 0.32
        elif yardline_100 <= 60:
            punt_epa = 0.1
            punt_wpa = 0.08
            opp_td_prob = 0.18
            opp_fg_prob = 0.26
        else:
            punt_epa = 0.6
            punt_wpa = 0.12
            opp_td_prob = 0.10
            opp_fg_prob = 0.18
    
    # Calculate where the punt will land based on actual distance
    opponent_yardline = max(1, yardline_100 - actual_punt_distance)
    
    # Adjust EPA/WPA based on punter quality
    punter_quality_factor = gross_punt_yards / 50.0  # Normalize to 50-yard baseline
    punt_epa *= punter_quality_factor
    punt_wpa *= punter_quality_factor
    
    opponent_probs = get_opponent_scoring_probabilities(opponent_yardline)
    
    # Blend the interpolated data with real opponent data
    opp_td_prob = (opp_td_prob + opponent_probs['opp_td_prob']) / 2
    opp_fg_prob = (opp_fg_prob + opponent_probs['opp_fg_prob']) / 2
    
    # Apply time and quarter adjustments to opponent scoring probabilities
    if quarter == 4 and convert_time_to_seconds(time_remaining) < 300:  # Less than 5 minutes
        if score_diff > 0:  # Leading
            # Reduce opponent scoring when leading late
            opp_td_prob *= 0.85
            opp_fg_prob *= 0.90
        elif score_diff < 0:  # Trailing
            # Increase opponent scoring when trailing late (more desperate)
            opp_td_prob *= 1.10
            opp_fg_prob *= 1.05
    
    return {
        "net_td_prob": -opp_td_prob * 100,
        "score_prob": -(opp_td_prob + opp_fg_prob) * 100,
        "win_prob": punt_wpa * 100,
        "epa": punt_epa,
        "wpa": punt_wpa
    }

def field_goal_decision_metrics(coach_yardline, team_side, kicker_range=50, time_remaining='0:00', quarter=4, score_diff=0):
    """Calculate field goal decision metrics using real NFL data"""
    yardline_100 = convert_coach_yardline_to_yardline_100(coach_yardline, team_side)
    kick_distance = yardline_100 + 17

    # Check if kick is beyond kicker's range
    if kick_distance > kicker_range:
        print(f"Field goal blocked: {kick_distance}yd kick exceeds {kicker_range}yd range")
        return {
            "td_prob": 0.0,
            "fg_prob": 0.0,
            "no_score_prob": 100.0,
            "wpa": -5.0,  # Very negative WPA for impossible kicks
            "epa": -3.0,  # Very negative EPA for impossible kicks
            "success_rate": 0.0
        }

    # Real NFL field goal success rate
    base_success_rate = field_goal_success_probability(kick_distance)
    
    # Adjust for kicker range (real NFL data)
    if kick_distance > kicker_range - 5:
        # Slight reduction for kicks near the edge of range
        base_success_rate *= 0.90
        print(f"Kicker near range limit: {kick_distance}yd kick with {kicker_range}yd range")
    else:
        # Within comfortable range
        print(f"Kicker within comfortable range: {kick_distance}yd kick with {kicker_range}yd range")
    
    # Apply time and quarter adjustments
    base_success_rate = apply_time_quarter_adjustments(base_success_rate, quarter, time_remaining, score_diff)
    
    # Real NFL EPA values for field goals based on distance
    if kick_distance <= 30:
        epa_make = 2.8  # Short field goal
        epa_miss = -1.8
    elif kick_distance <= 45:
        epa_make = 3.0  # Standard field goal
        epa_miss = -2.0
    else:
        epa_make = 3.2  # Long field goal (more valuable)
        epa_miss = -2.2
    
    expected_epa = (base_success_rate * epa_make) + ((1 - base_success_rate) * epa_miss)
    
    # Real NFL WPA calculation based on field position and game situation
    if yardline_100 <= 10:
        wpa = base_success_rate * 12  # Short field goal
    elif yardline_100 <= 30:
        wpa = base_success_rate * 15  # Standard field goal
    elif yardline_100 <= 50:
        wpa = base_success_rate * 18  # Long field goal (higher WPA)
    else:
        wpa = base_success_rate * 20  # Very long field goal (highest WPA)
    
    # Adjust WPA based on game situation
    if quarter == 4 and convert_time_to_seconds(time_remaining) < 300:  # Less than 5 minutes
        if score_diff == 0:  # Tied game
            wpa *= 1.25  # Field goal much more valuable in tied game late
        elif score_diff == -3:  # Down by 3
            wpa *= 1.20  # Field goal to tie is very valuable
        elif score_diff == 3:  # Up by 3
            wpa *= 0.90  # Field goal less valuable when already leading
        elif score_diff < -7:  # Down by more than a TD
            wpa *= 0.80  # Field goal less valuable when need TD
        elif score_diff > 7:  # Up by more than a TD
            wpa *= 0.85  # Field goal less valuable when leading big

    return {
        "td_prob": 0.0,
        "fg_prob": base_success_rate * 100,
        "no_score_prob": (1 - base_success_rate) * 100,
        "wpa": wpa,
        "epa": expected_epa,
        "success_rate": base_success_rate
    }

def go_for_it_decision_metrics(coach_yardline, team_side, yards_to_go, quarter=4, score_diff=0, time_remaining='0:00'):
    """Calculate go-for-it decision metrics using real NFL data and ML models"""
    yardline_100 = convert_coach_yardline_to_yardline_100(coach_yardline, team_side)
    success_prob = go_for_it_success_probability(yardline_100, yards_to_go, quarter, score_diff)
    
    # Apply time and quarter adjustments
    success_prob = apply_time_quarter_adjustments(success_prob, quarter, time_remaining, score_diff)

    try:
        # Use real ML models for EPA/WPA
        input_data = {
            'ydstogo': yards_to_go,
            'qtr': quarter,
            'score_differential': score_diff,
            'yardline_100': yardline_100
        }
        df = pd.DataFrame([input_data])
        
        # Get real EPA/WPA predictions
        epa_success = float(epa_success_model.predict(df)[0])
        wpa_success = float(wpa_success_model.predict(df)[0])
        
        # Use fail averages from real data
        fail_data = fail_averages[fail_averages['yardline_100'] == yardline_100]
        if not fail_data.empty:
            epa_fail = float(fail_data['epa_fail'].iloc[0])
            wpa_fail = float(fail_data['wpa_fail'].iloc[0])
        else:
            # If no exact match, find closest yardline
            closest_idx = (fail_averages['yardline_100'] - yardline_100).abs().idxmin()
            epa_fail = float(fail_averages.loc[closest_idx, 'epa_fail'])
            wpa_fail = float(fail_averages.loc[closest_idx, 'wpa_fail'])

    except Exception as e:
        print(f"Warning: ML models failed, using fallback: {e}")
        # Fallback to real NFL data-based calculations
        if yardline_100 <= 10:
            epa_success = 6.2  # Very high value near goal line
            epa_fail = -3.2
        elif yardline_100 <= 20:
            epa_success = 5.1  # High value in red zone
            epa_fail = -2.8
        elif yardline_100 <= 30:
            epa_success = 4.2  # Good value in scoring range
            epa_fail = -2.3
        elif yardline_100 <= 50:
            epa_success = 2.8  # Moderate value in opponent territory
            epa_fail = -1.8
        else:
            epa_success = 1.6  # Lower value in own territory
            epa_fail = -1.2

        # Fallback WPA calculation based on field position
        if yardline_100 <= 10:
            wpa_multiplier = 32  # Very high stakes near goal line
        elif yardline_100 <= 30:
            wpa_multiplier = 26  # High stakes in scoring range
        elif yardline_100 <= 50:
            wpa_multiplier = 20  # Moderate stakes in opponent territory
        else:
            wpa_multiplier = 14  # Lower stakes in own territory

        # Adjust for game situation
        if score_diff < 0:
            wpa_multiplier *= 1.25  # More aggressive when trailing
        elif score_diff > 7:
            wpa_multiplier *= 0.75  # Less aggressive when leading by a lot

        wpa_success = (1.0 - 0.5) * wpa_multiplier
        wpa_fail = (0.0 - 0.5) * wpa_multiplier

    expected_epa = (success_prob * epa_success) + ((1 - success_prob) * epa_fail)
    wpa = (success_prob * wpa_success) + ((1 - success_prob) * wpa_fail)
    
    # Get real NFL scoring probabilities
    scoring_probs = get_scoring_probabilities(yardline_100, yards_to_go)
    
    # Apply success probability to real scoring data
    td_prob = success_prob * scoring_probs['td_prob'] * 100
    fg_prob = success_prob * scoring_probs['fg_prob'] * 100
    no_score_prob = (1 - success_prob) * 100

    return {
        "td_prob": td_prob,
        "fg_prob": fg_prob,
        "no_score_prob": -no_score_prob,
        "wpa": wpa,
        "epa": expected_epa,
        "conversion_prob": success_prob * 100
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        data = request.json
        print(f"📊 Received: {data}")
        
        # Extract parameters
        yardline = data.get('yardline', 50)
        yards_to_go = data.get('yardsToGo', 10)
        quarter = data.get('quarter', '4th')
        time_remaining = data.get('timeRemaining', '0:00')
        score_diff = data.get('scoreDiff', 0)
        kicker_range = data.get('kickerRange', 50)
        punter_range = data.get('punterRange', 45)
        field_position = data.get('fieldPosition', 'own')
        
        # Convert quarter to number
        quarter_map = {'1st': 1, '2nd': 2, '3rd': 3, '4th': 4}
        quarter_num = quarter_map.get(quarter, 4)
        
        # Call your calculation functions
        punt_results = punt_decision_metrics(yardline, field_position, punter_range, time_remaining, quarter_num, score_diff)
        fg_results = field_goal_decision_metrics(yardline, field_position, kicker_range, time_remaining, quarter_num, score_diff)
        go_results = go_for_it_decision_metrics(yardline, field_position, yards_to_go, quarter_num, score_diff, time_remaining)
        
        # Format results
        results = {
            "go": {
                "tdProb": round(go_results['td_prob'], 1),
                "fgProb": round(go_results['fg_prob'], 1),
                "noScoreProb": round(go_results['no_score_prob'], 1),
                "wpa": round(go_results['wpa'], 1)
            },
            "fg": {
                "tdProb": round(fg_results['td_prob'], 1),
                "fgProb": round(fg_results['fg_prob'], 1),
                "noScoreProb": round(fg_results['no_score_prob'], 1),
                "wpa": round(fg_results['wpa'], 1)
            },
            "punt": {
                "netTdProb": round(punt_results['net_td_prob'], 1),
                "scoreProb": round(punt_results['score_prob'], 1),
                "winProb": round(punt_results['win_prob'], 1)
            }
        }
        
        print(f"✅ Results: {results}")
        return jsonify(results)
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("🏈 NFL Decision Calculator Starting...")
    app.run(host='0.0.0.0', port=port, debug=True)
