// Global variables
let currentDate = new Date();
let currentWeekOffset = 0;
let allScores = [];
let filteredScores = [];
let selectedSport = 'all';
let autoUpdateInterval;
let lastScoreHash = ''; // Track if scores actually changed
let hasLiveGames = false; // Track if there are live games

// ESPN API endpoints
const ESPN_APIS = {
    'nfl': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    'nba': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    'mlb': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    'nhl': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    'college-football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
    'college-basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
    'soccer': 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard'
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Set up sport filter buttons
    setupSportFilters();
    
    // Set up date navigation first
    updateWeekDisplay();
    
    // Ensure day dates are displayed immediately
    updateDayDateDisplays();
    
    // Set current day as active by default (this sets currentDate)
    setCurrentDayActive();
    
    // Update current date display
    updateCurrentDateDisplay();
    
    // Now load scores after everything is properly initialized
    loadAllScores();
    
    // Start auto-update (every 2 minutes)
    startAutoUpdate();
});

// Set the current day as active when page loads
function setCurrentDayActive() {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Map day of week to our button system (Monday = 1, Tuesday = 2, etc.)
    let targetDay;
    switch (currentDayOfWeek) {
        case 0: // Sunday
            targetDay = 'sunday';
            break;
        case 1: // Monday
            targetDay = 'monday';
            break;
        case 2: // Tuesday
            targetDay = 'tuesday';
            break;
        case 3: // Wednesday
            targetDay = 'wednesday';
            break;
        case 4: // Thursday
            targetDay = 'thursday';
            break;
        case 5: // Friday
            targetDay = 'friday';
            break;
        case 6: // Saturday
            targetDay = 'saturday';
            break;
    }
    
    // Set the current day button as active
    if (targetDay) {
        updateActiveButtons(targetDay);
        console.log(`Set ${targetDay} as active (current day)`);
        
        // Also set the current date to today so scores load correctly
        currentDate = today;
        
        // Update the custom date picker to show today
        const customDateInput = document.getElementById('customDate');
        if (customDateInput) {
            customDateInput.value = today.toISOString().split('T')[0];
        }
    }
}

// Set up sport filter buttons
function setupSportFilters() {
    const sportButtons = document.querySelectorAll('.sport-btn');
    
    // Ensure "All Sports" is active by default
    selectedSport = 'all';
    
    sportButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            sportButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update selected sport and filter
            selectedSport = this.getAttribute('data-sport');
            console.log('Sport button clicked:', selectedSport);
            filterScores();
        });
    });
    
    // Set initial active state
    const allSportsButton = document.querySelector('[data-sport="all"]');
    if (allSportsButton) {
        allSportsButton.classList.add('active');
    }
}

// Start auto-update functionality with smart refresh
function startAutoUpdate() {
    // Initial update
    updateScoresIfNeeded();
    
    // Set up smart refresh intervals
    setInterval(() => {
        updateScoresIfNeeded();
    }, 30000); // Check every 30 seconds
}

// Smart score update - only refresh if needed
async function updateScoresIfNeeded() {
    try {
        // Check if we have live games
        const liveGames = allScores.filter(game => game.status === 'live');
        hasLiveGames = liveGames.length > 0;
        
        if (hasLiveGames) {
            console.log(`Found ${liveGames.length} live games, refreshing scores...`);
            await loadAllScores(true); // Silent refresh
        } else {
            // No live games, refresh less frequently
            const timeSinceLastUpdate = Date.now() - (window.lastUpdateTime || 0);
            if (timeSinceLastUpdate > 300000) { // 5 minutes
                console.log('No live games, refreshing every 5 minutes...');
                await loadAllScores(true); // Silent refresh
            }
        }
    } catch (error) {
        console.error('Error in smart update:', error);
    }
}

// Show auto-update indicator
function showAutoUpdateIndicator() {
    const container = document.getElementById('scoresContainer');
    const existingIndicator = container.querySelector('.auto-update-indicator');
    
    if (!existingIndicator) {
        const indicator = document.createElement('div');
        indicator.className = 'auto-update-indicator';
        indicator.innerHTML = '🔄 Updating scores...';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007bff;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        container.appendChild(indicator);
        
        // Remove the indicator after 3 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 3000);
    }
}

// Stop auto-update (if needed)
function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
}

// Filter scores based on selected sport
function filterScores() {
    console.log('=== FILTERING DEBUG ===');
    console.log('Total scores available:', allScores.length);
    console.log('Selected sport:', selectedSport);
    console.log('All scores:', allScores);
    
    if (selectedSport === 'all') {
        filteredScores = [...allScores];
        console.log('Showing all sports, filtered count:', filteredScores.length);
    } else {
        filteredScores = allScores.filter(game => {
            console.log(`Game sport: "${game.sport}", Selected: "${selectedSport}", Match: ${game.sport === selectedSport}`);
            return game.sport === selectedSport;
        });
        console.log(`Filtered to ${selectedSport}, count:`, filteredScores.length);
    }
    
    console.log('Final filtered scores:', filteredScores);
    console.log('=== END FILTERING DEBUG ===');
    
    console.log('About to call displayScores with', filteredScores.length, 'scores');
    displayScores(filteredScores);
}

// Load scores from all sports for the current date
async function loadAllScores(silent = false) {
    const container = document.getElementById('scoresContainer');
    console.log('loadAllScores called, silent:', silent, 'currentDate:', currentDate);
    
    // No loading message - just fetch scores directly
    
    try {
        const scores = [];
        
        // Fetch scores from multiple sports for the current date
        const promises = [
            fetchScores('nfl', 'NFL'),
            fetchScores('nba', 'NBA'),
            fetchScores('mlb', 'MLB'),
            fetchScores('nhl', 'NHL'),
            fetchScores('college-football', 'College Football'),
            fetchScores('college-basketball', 'College Basketball'),
            fetchScores('soccer', 'Premier League')
        ];
        
        console.log('Fetching scores for date:', currentDate.toDateString());
        
        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                scores.push(...result.value);
            }
        });
        
        console.log('Total scores fetched:', scores.length);
        
        // Store the scores in the global variable
        allScores = scores;
        
        // If no scores were fetched, show sample data for testing
        if (allScores.length === 0) {
            console.log('No scores fetched from APIs, showing sample data');
            allScores = getSampleData();
        }
        
        // After fetching all scores, apply the filter
        console.log('Calling filterScores with', allScores.length, 'scores');
        filterScores();
        
    } catch (error) {
        console.error('Error loading scores:', error);
        console.log('Showing sample data due to error');
        allScores = getSampleData();
        filterScores();
    } finally {
        window.lastUpdateTime = Date.now(); // Update last update time
        console.log('loadAllScores completed');
    }
}

// Sample data for testing when APIs fail
function getSampleData() {
    return [
        {
            sport: 'nfl',
            sportName: 'NFL',
            awayTeam: 'Dallas Cowboys',
            homeTeam: 'New York Giants',
            awayScore: '24',
            homeScore: '17',
            status: 'final',
            time: 'Final',
            displayDate: 'Today',
            displayTime: '4:25 PM',
            fullDateTime: new Date().toISOString(),
            gameDate: new Date().toISOString()
        },
        {
            sport: 'nba',
            sportName: 'NBA',
            awayTeam: 'Los Angeles Lakers',
            homeTeam: 'Golden State Warriors',
            awayScore: '108',
            homeScore: '112',
            status: 'live',
            time: 'Q4 2:34',
            displayDate: 'Today',
            displayTime: '7:30 PM',
            fullDateTime: new Date().toISOString(),
            gameDate: new Date().toISOString()
        },
        {
            sport: 'mlb',
            sportName: 'MLB',
            awayTeam: 'Boston Red Sox',
            homeTeam: 'New York Yankees',
            awayScore: '3',
            homeScore: '2',
            status: 'scheduled',
            time: 'Scheduled',
            displayDate: 'Tomorrow',
            displayTime: '7:05 PM',
            fullDateTime: new Date(Date.now() + 86400000).toISOString(),
            gameDate: new Date(Date.now() + 86400000).toISOString()
        }
    ];
}

// Fetch scores from a specific sport API for the current date
async function fetchScores(sport, sportName) {
    try {
        const dateParam = currentDate.toISOString().split('T')[0].replace(/-/g, '');
        const apiUrl = `${ESPN_APIS[sport]}?dates=${dateParam}`;
        
        console.log(`Fetching ${sport} scores from: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        console.log(`${sport} API response:`, data);
        
        const parsedScores = parseESPNData(data, sport);
        console.log(`${sport} parsed scores:`, parsedScores);
        
        return parsedScores;
        
    } catch (error) {
        console.error(`Error fetching ${sport} scores:`, error);
        return [];
    }
}

// Parse ESPN API data into our format
function parseESPNData(espnData, sportKey) {
    if (!espnData || !espnData.events) return [];
    
    console.log(`Parsing ${sportKey} data:`, espnData);
    
    return espnData.events.map(event => {
        console.log(`Processing event:`, event);
        
        // Get the first competition (most events have one)
        const competition = event.competitions?.[0];
        if (!competition) {
            console.log('No competition found for event:', event);
            return null;
        }
        
        // Find home and away teams
        const competitors = competition.competitors || [];
        console.log('Competitors:', competitors);
        
        // Look for home/away indicators in different possible formats
        let homeTeam = null;
        let awayTeam = null;
        
        competitors.forEach(comp => {
            if (comp.homeAway === 'home' || comp.homeAway === 'true') {
                homeTeam = comp;
            } else if (comp.homeAway === 'away' || comp.awayAway === 'true') {
                awayTeam = comp;
            }
        });
        
        // If we didn't find home/away, try alternative indicators
        if (!homeTeam || !awayTeam) {
            competitors.forEach((comp, index) => {
                if (index === 0) awayTeam = comp;
                if (index === 1) homeTeam = comp;
            });
        }
        
        console.log('Home team:', homeTeam);
        console.log('Away team:', awayTeam);
        
        if (!homeTeam || !awayTeam) {
            console.log('Could not determine home/away teams for event:', event);
            return null;
        }
        
        const status = getGameStatus(event);
        const displayDateTime = getGameDateTime(event.date);
        
        const parsedGame = {
            sport: sportKey,
            sportName: getSportDisplayName(sportKey),
            awayTeam: awayTeam.team?.name || awayTeam.team?.displayName || 'TBD',
            homeTeam: homeTeam.team?.name || homeTeam.team?.displayName || 'TBD',
            awayScore: awayTeam.score || '0',
            homeScore: homeTeam.score || '0',
            status: status,
            time: getLiveGameTime(event),
            displayDate: displayDateTime.date,
            displayTime: displayDateTime.time,
            fullDateTime: event.date,
            gameDate: event.date
        };
        
        console.log('Parsed game:', parsedGame);
        return parsedGame;
    }).filter(Boolean); // Remove null entries
}

// Get sport display name
function getSportDisplayName(sportKey) {
    const sportNames = {
        'nfl': 'NFL',
        'nba': 'NBA',
        'mlb': 'MLB',
        'nhl': 'NHL',
        'college-football': 'College Football',
        'college-basketball': 'College Basketball',
        'soccer': 'Soccer'
    };
    return sportNames[sportKey] || sportKey;
}

// Get game date and time information
function getGameDateTime(gameDate) {
    const date = new Date(gameDate);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
    
    let dateDisplay = '';
    if (isToday) {
        dateDisplay = 'Today';
    } else if (isTomorrow) {
        dateDisplay = 'Tomorrow';
    } else {
        dateDisplay = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    const timeDisplay = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    
    const fullDisplay = `${dateDisplay} at ${timeDisplay}`;
    
    return {
        date: dateDisplay,
        time: timeDisplay,
        full: fullDisplay
    };
}

// Improved game status detection with more accurate logic
function getGameStatus(event) {
    const status = event.status;
    console.log('Event status:', status);
    
    if (!status || !status.type) {
        console.log('No status type found, defaulting to scheduled');
        return 'scheduled';
    }
    
    const state = status.type.state;
    const description = status.type.description || '';
    const period = status.period;
    const clock = status.clock || '';
    
    console.log('Status details:', { state, description, period, clock });
    
    // Check if game is finished - be more strict about this
    if (state === 'post' || 
        description.toLowerCase().includes('final') ||
        description.toLowerCase().includes('ended') ||
        description.toLowerCase().includes('complete') ||
        (period && period > 4 && !clock)) {
        console.log('Game is finished');
        return 'final';
    }
    
    // Check if game is live/in progress - be more strict
    if (state === 'in' && (
        description.toLowerCase().includes('quarter') ||
        description.toLowerCase().includes('period') ||
        description.toLowerCase().includes('inning') ||
        (period && period > 0 && clock) ||
        description.toLowerCase().includes('live'))) {
        console.log('Game is live');
        return 'live';
    }
    
    // Check if game is scheduled/upcoming
    if (state === 'pre' || 
        description.toLowerCase().includes('scheduled') ||
        description.toLowerCase().includes('upcoming') ||
        description.toLowerCase().includes('pregame')) {
        console.log('Game is scheduled');
        return 'scheduled';
    }
    
    // If state is 'in' but doesn't meet live criteria, treat as scheduled
    if (state === 'in' && !description.toLowerCase().includes('quarter') && !description.toLowerCase().includes('period')) {
        console.log('Game state is "in" but not clearly live, treating as scheduled');
        return 'scheduled';
    }
    
    console.log('Defaulting to scheduled status');
    return 'scheduled';
}

// Get live game time display with improved logic
function getLiveGameTime(event) {
    const status = event.status;
    const description = status.type?.description || '';
    const period = status.period;
    const clock = status.clock || '';
    
    console.log('Getting live game time:', { description, period, clock });
    
    if (description) {
        // Clean up the description for display
        let cleanDescription = description
            .replace(/final\/ot\d*/gi, 'Final')
            .replace(/final/gi, 'Final')
            .replace(/quarter/gi, 'Q')
            .replace(/period/gi, 'P')
            .replace(/inning/gi, 'Inning');
        
        // If we have period and clock, add them
        if (period && clock) {
            cleanDescription = `Q${period} ${clock}`;
        } else if (period) {
            cleanDescription = `Q${period}`;
        }
        
        console.log('Clean description:', cleanDescription);
        return cleanDescription;
    }
    
    // Fallback to period and clock if available
    if (period && clock) {
        return `Q${period} ${clock}`;
    } else if (period) {
        return `Q${period}`;
    }
    
    return 'Live';
}

// Display scores in the container with change detection
function displayScores(scores) {
    console.log('=== DISPLAY SCORES DEBUG ===');
    console.log('Received scores to display:', scores);
    console.log('Scores length:', scores ? scores.length : 'undefined');
    console.log('Scores type:', typeof scores);
    console.log('Scores is array:', Array.isArray(scores));
    
    const container = document.getElementById('scoresContainer');
    console.log('Container element:', container);
    console.log('Container current HTML before update:', container ? container.innerHTML : 'No container');
    
    if (!scores || scores.length === 0) {
        console.log('No scores to display, showing "no games" message');
        container.innerHTML = '<div class="info">No games scheduled for this date.</div>';
        updateLiveGamesCounter(0);
        return;
    }
    
    // Sort scores: live games first, then by date/time, then by sport
    scores.sort((a, b) => {
        // Live games first
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        
        // Then by date/time
        if (a.fullDateTime !== b.fullDateTime) {
            return new Date(a.fullDateTime) - new Date(b.fullDateTime);
        }
        
        // Finally by sport
        return a.sport.localeCompare(b.sport);
    });
    
    console.log('Sorted scores:', scores);
    
    // Update live games counter
    const liveGames = scores.filter(game => game.status === 'live');
    updateLiveGamesCounter(liveGames.length);
    
    // Check for score changes and highlight them
    const scoresHTML = scores.map(game => {
        const scoreChanged = checkScoreChange(game);
        const changeClass = scoreChanged ? 'score-changed' : '';
        
        // Get team logos
        const awayLogo = getTeamLogo(game.awayTeam, game.sport);
        const homeLogo = getTeamLogo(game.homeTeam, game.sport);
        
        return `
            <div class="score-card ${changeClass}" data-game-id="${game.sport}-${game.awayTeam}-${game.homeTeam}">
                <div class="game-header">
                    <span class="sport-type">${game.sport}</span>
                    <span class="game-status ${game.status}">${getStatusDisplay(game.status)}</span>
                </div>
                <div class="teams">
                    <div class="team ${getWinner(game) === 'away' ? 'winner' : ''}">
                        <div class="team-info">
                            <div class="team-logo">
                                ${awayLogo}
                            </div>
                            <span class="team-name">${game.awayTeam}</span>
                        </div>
                        <span class="team-score">${game.status === 'scheduled' ? '' : game.awayScore}</span>
                    </div>
                    <div class="team ${getWinner(game) === 'home' ? 'winner' : ''}">
                        <div class="team-info">
                            <div class="team-logo">
                                ${homeLogo}
                            </div>
                            <span class="team-name">${game.homeTeam}</span>
                        </div>
                        <span class="team-score">${game.status === 'scheduled' ? '' : game.homeScore}</span>
                    </div>
                </div>
                <div class="game-info">
                    <span class="game-time">${getGameTimeDisplay(game)}</span>
                    <span class="game-date">${game.displayDate}</span>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('Generated HTML length:', scoresHTML.length);
    console.log('Generated HTML preview:', scoresHTML.substring(0, 200) + '...');
    
    // IMPORTANT: Clear the container completely before adding new content
    container.innerHTML = '';
    console.log('Container cleared, now adding scores');
    
    // Add the scores HTML
    container.innerHTML = scoresHTML;
    console.log('Container HTML updated, new length:', container.innerHTML.length);
    console.log('Container final HTML:', container.innerHTML);
    
    // Remove highlight after animation
    setTimeout(() => {
        document.querySelectorAll('.score-changed').forEach(card => {
            card.classList.remove('score-changed');
        });
    }, 2000);
    
    console.log('=== END DISPLAY SCORES DEBUG ===');
}

// Update live games counter
function updateLiveGamesCounter(count) {
    const counter = document.getElementById('liveGamesCount');
    if (counter) {
        counter.textContent = count;
        
        // Hide counter if no live games
        const counterContainer = counter.parentElement;
        if (count === 0) {
            counterContainer.style.display = 'none';
        } else {
            counterContainer.style.display = 'flex';
        }
    }
}

// Check if a game's score has changed
function checkScoreChange(newGame) {
    if (!window.previousScores) {
        window.previousScores = {};
        return false;
    }
    
    const gameKey = `${newGame.sport}-${newGame.awayTeam}-${newGame.homeTeam}`;
    const previousGame = window.previousScores[gameKey];
    
    if (!previousGame) {
        window.previousScores[gameKey] = { ...newGame };
        return false;
    }
    
    // Check if score changed
    const scoreChanged = previousGame.awayScore !== newGame.awayScore || 
                        previousGame.homeScore !== newGame.homeScore ||
                        previousGame.status !== newGame.status;
    
    // Update stored score
    window.previousScores[gameKey] = { ...newGame };
    
    return scoreChanged;
}

// Get status display text
function getStatusDisplay(status) {
    switch (status) {
        case 'live':
            return '🔴 LIVE';
        case 'final':
            return '🏁 FINAL';
        case 'scheduled':
            return '⏰ SCHEDULED';
        default:
            return status;
    }
}

// Determine winner for final games
function getWinner(game) {
    if (game.status !== 'final') return null;
    
    const awayScore = parseInt(game.awayScore) || 0;
    const homeScore = parseInt(game.homeScore) || 0;
    
    if (awayScore > homeScore) return 'away';
    if (homeScore > awayScore) return 'home';
    return 'tie'; // For tied games
}

// Week navigation functions
function previousWeek() {
    currentWeekOffset--;
    updateWeekDisplay();
    updateWeekButtons();
    
    // Update current date to Monday of the selected week
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(today.getDate() - daysToMonday + (currentWeekOffset * 7));
    currentDate = monday;
    
    // Update the custom date picker
    document.getElementById('customDate').value = currentDate.toISOString().split('T')[0];
    
    // Load scores for the new date
    loadAllScores();
    updateCurrentDateDisplay();
}

function nextWeek() {
    currentWeekOffset++;
    updateWeekDisplay();
    updateWeekButtons();
    
    // Update current date to Monday of the selected week
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(today.getDate() - daysToMonday + (currentWeekOffset * 7));
    currentDate = monday;
    
    // Update the custom date picker
    document.getElementById('customDate').value = currentDate.toISOString().split('T')[0];
    
    // Load scores for the new date
    loadAllScores();
    updateCurrentDateDisplay();
}

function updateWeekDisplay() {
    const weekLabel = document.getElementById('weekLabel');
    const weekDates = document.getElementById('weekDates');
    
    if (currentWeekOffset === 0) {
        weekLabel.textContent = 'Current Week';
    } else if (currentWeekOffset < 0) {
        weekLabel.textContent = `${Math.abs(currentWeekOffset)} Week${Math.abs(currentWeekOffset) > 1 ? 's' : ''} Ago`;
    } else {
        weekLabel.textContent = `${currentWeekOffset} Week${currentWeekOffset > 1 ? 's' : ''} Ahead`;
    }
    
    // Calculate the Monday of the target week
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 1, Sunday = 0
    
    monday.setDate(today.getDate() - daysToMonday + (currentWeekOffset * 7));
    
    // Generate week date range
    const weekStart = new Date(monday);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);
    
    const startDate = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    weekDates.textContent = `${startDate} - ${endDate}`;
}

function updateWeekButtons() {
    // Update the week buttons to reflect the current week offset
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    monday.setDate(today.getDate() - daysToMonday + (currentWeekOffset * 7));
    
    // Store the Monday of the current week for week button calculations
    window.currentWeekMonday = monday;
    
    console.log('Updated week buttons, current week Monday:', monday.toDateString());
    
    // Update the date displays for each day
    updateDayDateDisplays();
}

function updateDayDateDisplays() {
    if (!window.currentWeekMonday) {
        console.log('No currentWeekMonday set, calling updateWeekButtons first');
        updateWeekButtons();
        return;
    }
    
    const monday = window.currentWeekMonday;
    console.log('Updating day date displays, week starting:', monday.toDateString());
    
    // Update each day's date display
    const dayElements = [
        { id: 'mondayDate', day: 1 },
        { id: 'tuesdayDate', day: 2 },
        { id: 'wednesdayDate', day: 3 },
        { id: 'thursdayDate', day: 4 },
        { id: 'fridayDate', day: 5 },
        { id: 'saturdayDate', day: 6 },
        { id: 'sundayDate', day: 0 }
    ];
    
    dayElements.forEach(({ id, day }) => {
        const dateElement = document.getElementById(id);
        if (dateElement) {
            const targetDate = new Date(monday);
            const daysToAdd = day === 0 ? 6 : day - 1;
            targetDate.setDate(monday.getDate() + daysToAdd);
            
            // Format as M/D (e.g., 8/19)
            const month = targetDate.getMonth() + 1; // getMonth() returns 0-11
            const date = targetDate.getDate();
            const formattedDate = `${month}/${date}`;
            
            dateElement.textContent = formattedDate;
            console.log(`Updated ${id}: ${formattedDate} (${targetDate.toDateString()})`);
        } else {
            console.log(`Date element not found: ${id}`);
        }
    });
}

// Date navigation functions
function goToDate(dateType) {
    // Handle week day navigation
    switch (dateType) {
        case 'monday':
            currentDate = getWeekdayDate(1);
            break;
        case 'tuesday':
            currentDate = getWeekdayDate(2);
            break;
        case 'wednesday':
            currentDate = getWeekdayDate(3);
            break;
        case 'thursday':
            currentDate = getWeekdayDate(4);
            break;
        case 'friday':
            currentDate = getWeekdayDate(5);
            break;
        case 'saturday':
            currentDate = getWeekdayDate(6);
            break;
        case 'sunday':
            currentDate = getWeekdayDate(0);
            break;
    }
    
    // Update the custom date picker to match the selected date
    document.getElementById('customDate').value = currentDate.toISOString().split('T')[0];
    
    // Update active button states
    updateActiveButtons(dateType);
    
    // Load scores for the new date
    loadAllScores();
    updateCurrentDateDisplay();
}

// Get date for a specific weekday in the current week view
function getWeekdayDate(targetDay) {
    if (!window.currentWeekMonday) {
        updateWeekButtons();
    }
    
    const monday = window.currentWeekMonday;
    const targetDate = new Date(monday);
    
    // Calculate days to add (Monday = 0, Tuesday = 1, etc.)
    const daysToAdd = targetDay === 0 ? 6 : targetDay - 1;
    targetDate.setDate(monday.getDate() + daysToAdd);
    
    return targetDate;
}

function goToCustomDate(dateString) {
    if (!dateString) return;
    
    currentDate = new Date(dateString);
    
    // Calculate which week this date belongs to and update the week offset
    updateWeekOffsetForDate(currentDate);
    
    // Update the week display and buttons
    updateWeekDisplay();
    updateWeekButtons();
    
    // Update active button states (clear all since it's a custom date)
    updateActiveButtons('custom');
    
    // Load scores for the new date
    loadAllScores();
    updateCurrentDateDisplay();
}

// Calculate the week offset for a given date
function updateWeekOffsetForDate(targetDate) {
    const today = new Date();
    const targetMonday = getMondayOfWeek(targetDate);
    const todayMonday = getMondayOfWeek(today);
    
    // Calculate the difference in weeks
    const timeDiff = targetMonday.getTime() - todayMonday.getTime();
    const weekDiff = Math.round(timeDiff / (1000 * 3600 * 24 * 7));
    
    currentWeekOffset = weekDiff;
}

// Get the Monday of the week for a given date
function getMondayOfWeek(date) {
    const monday = new Date(date);
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(date.getDate() - daysToMonday);
    return monday;
}

function updateActiveButtons(activeType) {
    // Remove active class from all week buttons
    document.querySelectorAll('.week-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to the appropriate button
    if (activeType !== 'custom') {
        const weekButtons = document.querySelectorAll('.week-btn');
        let activeButton = null;
        
        switch (activeType) {
            case 'monday':
                activeButton = weekButtons[0];
                break;
            case 'tuesday':
                activeButton = weekButtons[1];
                break;
            case 'wednesday':
                activeButton = weekButtons[2];
                break;
            case 'thursday':
                activeButton = weekButtons[3];
                break;
            case 'friday':
                activeButton = weekButtons[4];
                break;
            case 'saturday':
                activeButton = weekButtons[5];
                break;
            case 'sunday':
                activeButton = weekButtons[6];
                break;
        }
        
        if (activeButton) {
            activeButton.classList.add('active');
            console.log(`Activated ${activeType} button`);
            
            // Scroll the active button into view if needed
            activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}

// Refresh scores (fetch from APIs)
function refreshScores() {
    loadAllScores();
}

// Update current date display
function updateCurrentDateDisplay() {
    const dateText = document.getElementById('currentDateDisplay');
    if (!dateText) return;
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const displayDate = currentDate.toLocaleDateString('en-US', options);
    dateText.textContent = displayDate;
}

// Auto-refresh every 2 minutes for live data
setInterval(() => {
    if (allScores.length > 0) {
        loadAllScores();
    }
}, 120000); // 2 minutes

// Add interactivity to score cards
document.addEventListener('click', function(e) {
    if (e.target.closest('.score-card')) {
        const card = e.target.closest('.score-card');
        card.style.transform = 'scale(0.98)';
        
        setTimeout(() => {
            card.style.transform = '';
        }, 150);
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'r' || e.key === 'R') {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            refreshScores();
        }
    }
});

// Error handling for network issues
window.addEventListener('online', function() {
    if (allScores.length === 0) {
        loadAllScores();
    }
});

window.addEventListener('offline', function() {
    const container = document.getElementById('scoresContainer');
    if (allScores.length === 0) {
        container.innerHTML = '<div class="error">You are offline. Please check your internet connection.</div>';
    }
});

// Get team logo from working sports logo APIs
function getTeamLogo(teamName, sport) {
    console.log(`Getting logo for: ${teamName} (${sport})`);
    
    // Try to get logo from working sources
    const logoUrl = getWorkingLogoUrl(teamName, sport);
    console.log(`Logo URL generated: ${logoUrl}`);
    
    if (logoUrl) {
        // Return an img tag with the real logo and hidden fallback
        const logoHTML = `
            <img src="${logoUrl}" alt="${teamName}" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                 style="width: 100%; height: 100%; border-radius: 50%; object-fit: contain; display: block;" />
            <div class="fallback-logo" style="display: none; background: ${getFallbackColor(sport)}; width: 100%; height: 100%; border-radius: 50%; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${getTeamInitials(teamName)}</div>
        `;
        console.log(`Logo HTML generated for ${teamName}:`, logoHTML);
        return logoHTML;
    }
    
    // If no working URL, just show fallback
    console.log(`No logo URL found for ${teamName}, using fallback`);
    return `<div class="fallback-logo" style="background: ${getFallbackColor(sport)}; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${getTeamInitials(teamName)}</div>`;
}

// Get fallback color for different sports
function getFallbackColor(sport) {
    const sportColors = {
        'nfl': '#8B4513',      // Brown for NFL
        'nba': '#FF6B35',      // Orange for NBA
        'mlb': '#228B22',      // Green for MLB
        'nhl': '#1E90FF',      // Blue for NHL
        'college-football': '#DC143C', // Crimson for College Football
        'college-basketball': '#9932CC', // Purple for College Basketball
        'soccer': '#32CD32'    // Lime Green for Soccer
    };
    
    return sportColors[sport] || '#666';
}

// Get team initials for fallback
function getTeamInitials(teamName) {
    return teamName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
}

// Get working team logo URLs from reliable sources
function getWorkingLogoUrl(teamName, sport) {
    console.log(`getWorkingLogoUrl called for: ${teamName} (${sport})`);
    
    // Clean team name for better matching
    const cleanName = teamName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '');
    
    // Use more reliable logo sources
    if (sport === 'nba') {
        console.log(`NBA logo lookup for: ${teamName}`);
        const nbaUrl = getNBALogoUrl(teamName);
        console.log(`NBA URL result: ${nbaUrl}`);
        return nbaUrl;
    } else if (sport === 'mlb') {
        console.log(`MLB logo lookup for: ${teamName}`);
        const mlbUrl = getMLBLogoUrl(teamName);
        console.log(`MLB URL result: ${mlbUrl}`);
        return mlbUrl;
    } else if (sport === 'nfl') {
        console.log(`NFL logo lookup for: ${teamName}`);
        const nflUrl = getNFLLogoUrl(teamName);
        console.log(`NFL URL result: ${nflUrl}`);
        return nflUrl;
    } else if (sport === 'nhl') {
        console.log(`NHL logo lookup for: ${teamName}`);
        const nhlUrl = getNHLLogoUrl(teamName);
        console.log(`NHL URL result: ${nhlUrl}`);
        return nhlUrl;
    } else if (sport === 'soccer') {
        console.log(`Soccer logo lookup for: ${teamName}`);
        const soccerUrl = getSoccerLogoUrl(teamName);
        console.log(`Soccer URL result: ${soccerUrl}`);
        return soccerUrl;
    }
    
    console.log(`No specific sport handler for: ${sport}, using generic fallback`);
    // Generic fallback for other sports
    return `https://via.placeholder.com/80x80/007bff/ffffff?text=${encodeURIComponent(teamName.substring(0, 2))}`;
}

// Get NBA logo URLs with flexible name matching
function getNBALogoUrl(teamName) {
    const nbaLogos = {
        'Atlanta Hawks': 'https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg',
        'Boston Celtics': 'https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg',
        'Brooklyn Nets': 'https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg',
        'Charlotte Hornets': 'https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg',
        'Chicago Bulls': 'https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg',
        'Cleveland Cavaliers': 'https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg',
        'Dallas Mavericks': 'https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg',
        'Denver Nuggets': 'https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg',
        'Detroit Pistons': 'https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg',
        'Golden State Warriors': 'https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg',
        'Houston Rockets': 'https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg',
        'Indiana Pacers': 'https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg',
        'Los Angeles Clippers': 'https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg',
        'Los Angeles Lakers': 'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg',
        'Memphis Grizzlies': 'https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg',
        'Miami Heat': 'https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg',
        'Milwaukee Bucks': 'https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg',
        'Minnesota Timberwolves': 'https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg',
        'New Orleans Pelicans': 'https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg',
        'New York Knicks': 'https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg',
        'Oklahoma City Thunder': 'https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg',
        'Orlando Magic': 'https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg',
        'Philadelphia 76ers': 'https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg',
        'Phoenix Suns': 'https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg',
        'Portland Trail Blazers': 'https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg',
        'Sacramento Kings': 'https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg',
        'San Antonio Spurs': 'https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg',
        'Toronto Raptors': 'https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg',
        'Utah Jazz': 'https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg',
        'Washington Wizards': 'https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg'
    };
    
    // Try exact match first
    if (nbaLogos[teamName]) {
        return nbaLogos[teamName];
    }
    
    // Try flexible matching for common variations
    const teamVariations = {
        'Lakers': 'Los Angeles Lakers',
        'Celtics': 'Boston Celtics',
        'Bulls': 'Chicago Bulls',
        'Warriors': 'Golden State Warriors',
        'Heat': 'Miami Heat',
        'Knicks': 'New York Knicks',
        'Nets': 'Brooklyn Nets',
        'Hawks': 'Atlanta Hawks',
        'Cavaliers': 'Cleveland Cavaliers',
        'Mavericks': 'Dallas Mavericks',
        'Nuggets': 'Denver Nuggets',
        'Pistons': 'Detroit Pistons',
        'Rockets': 'Houston Rockets',
        'Pacers': 'Indiana Pacers',
        'Clippers': 'Los Angeles Clippers',
        'Grizzlies': 'Memphis Grizzlies',
        'Bucks': 'Milwaukee Bucks',
        'Timberwolves': 'Minnesota Timberwolves',
        'Pelicans': 'New Orleans Pelicans',
        'Thunder': 'Oklahoma City Thunder',
        'Magic': 'Orlando Magic',
        '76ers': 'Philadelphia 76ers',
        'Suns': 'Phoenix Suns',
        'Trail Blazers': 'Portland Trail Blazers',
        'Kings': 'Sacramento Kings',
        'Spurs': 'San Antonio Spurs',
        'Raptors': 'Toronto Raptors',
        'Jazz': 'Utah Jazz',
        'Wizards': 'Washington Wizards',
        // ESPN API variations
        'LA Lakers': 'Los Angeles Lakers',
        'LA Clippers': 'Los Angeles Clippers',
        'Golden State': 'Golden State Warriors',
        'New York': 'New York Knicks',
        'Philadelphia': 'Philadelphia 76ers',
        'Portland': 'Portland Trail Blazers',
        'Sacramento': 'Sacramento Kings',
        'San Antonio': 'San Antonio Spurs',
        'Toronto': 'Toronto Raptors',
        'Utah': 'Utah Jazz',
        'Washington': 'Washington Wizards'
    };
    
    // Check for variations
    for (const [shortName, fullName] of Object.entries(teamVariations)) {
        if (teamName.includes(shortName) || shortName.includes(teamName)) {
            console.log(`Found NBA variation: ${teamName} -> ${fullName}`);
            return nbaLogos[fullName];
        }
    }
    
    // Try partial matching for remaining cases
    const teamNameLower = teamName.toLowerCase();
    for (const [fullName, logoUrl] of Object.entries(nbaLogos)) {
        const fullNameLower = fullName.toLowerCase();
        // Check if any word in the full name matches
        const fullNameWords = fullNameLower.split(' ');
        const teamNameWords = teamNameLower.split(' ');
        
        for (const word of teamNameWords) {
            if (word.length > 2 && fullNameWords.includes(word)) {
                console.log(`Found NBA partial match: ${teamName} -> ${fullName} (via word: ${word})`);
                return logoUrl;
            }
        }
    }
    
    console.log(`No NBA logo found for: ${teamName}`);
    return null;
}

// Get MLB logo URLs with flexible name matching
function getMLBLogoUrl(teamName) {
    const mlbLogos = {
        'Arizona Diamondbacks': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/109.svg',
        'Atlanta Braves': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/144.svg',
        'Baltimore Orioles': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/110.svg',
        'Boston Red Sox': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/111.svg',
        'Chicago Cubs': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/112.svg',
        'Chicago White Sox': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/145.svg',
        'Cincinnati Reds': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/113.svg',
        'Cleveland Guardians': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/114.svg',
        'Colorado Rockies': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/115.svg',
        'Detroit Tigers': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/116.svg',
        'Houston Astros': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/117.svg',
        'Kansas City Royals': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/118.svg',
        'Los Angeles Angels': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/108.svg',
        'Los Angeles Dodgers': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/119.svg',
        'Miami Marlins': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/146.svg',
        'Milwaukee Brewers': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/158.svg',
        'Minnesota Twins': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/142.svg',
        'New York Mets': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/121.svg',
        'New York Yankees': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/147.svg',
        'Oakland Athletics': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/133.svg',
        'Philadelphia Phillies': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/143.svg',
        'Pittsburgh Pirates': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/134.svg',
        'San Diego Padres': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/135.svg',
        'San Francisco Giants': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/137.svg',
        'Seattle Mariners': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/136.svg',
        'St. Louis Cardinals': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/138.svg',
        'Tampa Bay Rays': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/139.svg',
        'Texas Rangers': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/140.svg',
        'Toronto Blue Jays': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/141.svg',
        'Washington Nationals': 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/120.svg'
    };
    
    // Try exact match first
    if (mlbLogos[teamName]) {
        return mlbLogos[teamName];
    }
    
    // Try flexible matching for common variations
    const teamVariations = {
        'Diamondbacks': 'Arizona Diamondbacks',
        'Braves': 'Atlanta Braves',
        'Orioles': 'Baltimore Orioles',
        'Red Sox': 'Boston Red Sox',
        'Cubs': 'Chicago Cubs',
        'White Sox': 'Chicago White Sox',
        'Reds': 'Cincinnati Reds',
        'Guardians': 'Cleveland Guardians',
        'Indians': 'Cleveland Guardians', // Old name
        'Rockies': 'Colorado Rockies',
        'Tigers': 'Detroit Tigers',
        'Astros': 'Houston Astros',
        'Royals': 'Kansas City Royals',
        'Angels': 'Los Angeles Angels',
        'Dodgers': 'Los Angeles Dodgers',
        'Marlins': 'Miami Marlins',
        'Brewers': 'Milwaukee Brewers',
        'Twins': 'Minnesota Twins',
        'Mets': 'New York Mets',
        'Yankees': 'New York Yankees',
        'Athletics': 'Oakland Athletics',
        'A\'s': 'Oakland Athletics',
        'Phillies': 'Philadelphia Phillies',
        'Pirates': 'Pittsburgh Pirates',
        'Padres': 'San Diego Padres',
        'Giants': 'San Francisco Giants',
        'Mariners': 'Seattle Mariners',
        'Cardinals': 'St. Louis Cardinals',
        'Rays': 'Tampa Bay Rays',
        'Rangers': 'Texas Rangers',
        'Blue Jays': 'Toronto Blue Jays',
        'Nationals': 'Washington Nationals',
        // ESPN API variations
        'LA Angels': 'Los Angeles Angels',
        'LA Dodgers': 'Los Angeles Dodgers',
        'NY Mets': 'New York Mets',
        'NY Yankees': 'New York Yankees',
        'St. Louis': 'St. Louis Cardinals',
        'Tampa Bay': 'Tampa Bay Rays'
    };
    
    // Check for variations
    for (const [shortName, fullName] of Object.entries(teamVariations)) {
        if (teamName.includes(shortName) || shortName.includes(teamName)) {
            console.log(`Found MLB variation: ${teamName} -> ${fullName}`);
            return mlbLogos[fullName];
        }
    }
    
    // Try partial matching for remaining cases
    const teamNameLower = teamName.toLowerCase();
    for (const [fullName, logoUrl] of Object.entries(mlbLogos)) {
        const fullNameLower = fullName.toLowerCase();
        // Check if any word in the full name matches
        const fullNameWords = fullNameLower.split(' ');
        const teamNameWords = teamNameLower.split(' ');
        
        for (const word of teamNameWords) {
            if (word.length > 2 && fullNameWords.includes(word)) {
                console.log(`Found MLB partial match: ${teamName} -> ${fullName} (via word: ${word})`);
                return logoUrl;
            }
        }
    }
    
    console.log(`No MLB logo found for: ${teamName}`);
    return null;
}

// Get NFL logo URLs with flexible name matching
function getNFLLogoUrl(teamName) {
    const nflLogos = {
        'Arizona Cardinals': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/ARI',
        'Atlanta Falcons': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/ATL',
        'Baltimore Ravens': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/BAL',
        'Buffalo Bills': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/BUF',
        'Carolina Panthers': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/CAR',
        'Chicago Bears': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/CHI',
        'Cincinnati Bengals': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/CIN',
        'Cleveland Browns': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/CLE',
        'Dallas Cowboys': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/DAL',
        'Denver Broncos': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/DEN',
        'Detroit Lions': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/DET',
        'Green Bay Packers': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/GB',
        'Houston Texans': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/HOU',
        'Indianapolis Colts': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/IND',
        'Jacksonville Jaguars': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/JAX',
        'Kansas City Chiefs': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/KC',
        'Las Vegas Raiders': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/LV',
        'Los Angeles Chargers': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/LAC',
        'Los Angeles Rams': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/LA',
        'Miami Dolphins': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/MIA',
        'Minnesota Vikings': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/MIN',
        'New England Patriots': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/NE',
        'New Orleans Saints': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/NO',
        'New York Giants': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/NYG',
        'New York Jets': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/NYJ',
        'Philadelphia Eagles': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/PHI',
        'Pittsburgh Steelers': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/PIT',
        'San Francisco 49ers': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/SF',
        'Seattle Seahawks': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/SEA',
        'Tampa Bay Buccaneers': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/TB',
        'Tennessee Titans': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/TEN',
        'Washington Commanders': 'https://static.www.nfl.com/t_headshot_desktop/f_auto/league/api/clubs/logos/WAS'
    };
    
    // Try exact match first
    if (nflLogos[teamName]) {
        return nflLogos[teamName];
    }
    
    // Try flexible matching for common variations
    const teamVariations = {
        'Cardinals': 'Arizona Cardinals',
        'Falcons': 'Atlanta Falcons',
        'Ravens': 'Baltimore Ravens',
        'Bills': 'Buffalo Bills',
        'Panthers': 'Carolina Panthers',
        'Bears': 'Chicago Bears',
        'Bengals': 'Cincinnati Bengals',
        'Browns': 'Cleveland Browns',
        'Cowboys': 'Dallas Cowboys',
        'Broncos': 'Denver Broncos',
        'Lions': 'Detroit Lions',
        'Packers': 'Green Bay Packers',
        'Texans': 'Houston Texans',
        'Colts': 'Indianapolis Colts',
        'Jaguars': 'Jacksonville Jaguars',
        'Chiefs': 'Kansas City Chiefs',
        'Raiders': 'Las Vegas Raiders',
        'Chargers': 'Los Angeles Chargers',
        'Rams': 'Los Angeles Rams',
        'Dolphins': 'Miami Dolphins',
        'Vikings': 'Minnesota Vikings',
        'Patriots': 'New England Patriots',
        'Saints': 'New Orleans Saints',
        'Giants': 'New York Giants',
        'Jets': 'New York Jets',
        'Eagles': 'Philadelphia Eagles',
        'Steelers': 'Pittsburgh Steelers',
        '49ers': 'San Francisco 49ers',
        'Seahawks': 'Seattle Seahawks',
        'Buccaneers': 'Tampa Bay Buccaneers',
        'Titans': 'Tennessee Titans',
        'Commanders': 'Washington Commanders',
        // ESPN API variations
        'LA Chargers': 'Los Angeles Chargers',
        'LA Rams': 'Los Angeles Rams',
        'NY Giants': 'New York Giants',
        'NY Jets': 'New York Jets',
        'San Francisco': 'San Francisco 49ers',
        'Tampa Bay': 'Tampa Bay Buccaneers'
    };
    
    // Check for variations
    for (const [shortName, fullName] of Object.entries(teamVariations)) {
        if (teamName.includes(shortName) || shortName.includes(teamName)) {
            console.log(`Found NFL variation: ${teamName} -> ${fullName}`);
            return nflLogos[fullName];
        }
    }
    
    // Try partial matching for remaining cases
    const teamNameLower = teamName.toLowerCase();
    for (const [fullName, logoUrl] of Object.entries(nflLogos)) {
        const fullNameLower = fullName.toLowerCase();
        // Check if any word in the full name matches
        const fullNameWords = fullNameLower.split(' ');
        const teamNameWords = teamNameLower.split(' ');
        
        for (const word of teamNameWords) {
            if (word.length > 2 && fullNameWords.includes(word)) {
                console.log(`Found NFL partial match: ${teamName} -> ${fullName} (via word: ${word})`);
                return logoUrl;
            }
        }
    }
    
    console.log(`No NFL logo found for: ${teamName}`);
    return null;
}

// Get NHL logo URLs
function getNHLLogoUrl(teamName) {
    const nhlLogos = {
        'Anaheim Ducks': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/ANA.svg',
        'Arizona Coyotes': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/ARI.svg',
        'Boston Bruins': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/BOS.svg',
        'Buffalo Sabres': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/BUF.svg',
        'Calgary Flames': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/CGY.svg',
        'Carolina Hurricanes': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/CAR.svg',
        'Chicago Blackhawks': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/CHI.svg',
        'Colorado Avalanche': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/COL.svg',
        'Columbus Blue Jackets': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/CBJ.svg',
        'Dallas Stars': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/DAL.svg',
        'Detroit Red Wings': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/DET.svg',
        'Edmonton Oilers': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/EDM.svg',
        'Florida Panthers': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/FLA.svg',
        'Los Angeles Kings': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/LAK.svg',
        'Minnesota Wild': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/MIN.svg',
        'Montreal Canadiens': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/MTL.svg',
        'Nashville Predators': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/NSH.svg',
        'New Jersey Devils': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/NJD.svg',
        'New York Islanders': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/NYI.svg',
        'New York Rangers': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/NYR.svg',
        'Ottawa Senators': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/OTT.svg',
        'Philadelphia Flyers': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/PHI.svg',
        'Pittsburgh Penguins': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/PIT.svg',
        'San Jose Sharks': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/SJS.svg',
        'Seattle Kraken': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/SEA.svg',
        'St. Louis Blues': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/STL.svg',
        'Tampa Bay Lightning': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/TBL.svg',
        'Toronto Maple Leafs': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/TOR.svg',
        'Vancouver Canucks': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/VAN.svg',
        'Vegas Golden Knights': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/VGK.svg',
        'Washington Capitals': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/WSH.svg',
        'Winnipeg Jets': 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/WPG.svg'
    };
    
    return nhlLogos[teamName] || null;
}



// Get Soccer logo URLs with flexible name matching
function getSoccerLogoUrl(teamName) {
    const soccerLogos = {
        // Premier League
        'Arsenal': 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
        'Aston Villa': 'https://upload.wikimedia.org/wikipedia/en/9/9f/Aston_Villa_logo.svg',
        'Bournemouth': 'https://upload.wikimedia.org/wikipedia/en/e/e5/AFC_Bournemouth_%282013%29.svg',
        'Brentford': 'https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg',
        'Brighton': 'https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg',
        'Burnley': 'https://upload.wikimedia.org/wikipedia/en/6/62/Burnley_FC_Logo.svg',
        'Chelsea': 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
        'Crystal Palace': 'https://upload.wikimedia.org/wikipedia/en/0/0c/Crystal_Palace_FC_logo.svg',
        'Everton': 'https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg',
        'Fulham': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Fulham_FC_%28shield%29.svg',
        'Liverpool': 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
        'Luton Town': 'https://upload.wikimedia.org/wikipedia/en/9/9c/Luton_Town_logo.svg',
        'Manchester City': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
        'Manchester United': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
        'Newcastle United': 'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg',
        'Nottingham Forest': 'https://upload.wikimedia.org/wikipedia/en/b/b2/Nottingham_Forest_logo.svg',
        'Sheffield United': 'https://upload.wikimedia.org/wikipedia/en/9/9c/Sheffield_United_FC_logo.svg',
        'Tottenham Hotspur': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
        'West Ham United': 'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg',
        'Wolves': 'https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg',
        
        // La Liga
        'Real Madrid': 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
        'Barcelona': 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
        'Atletico Madrid': 'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg',
        'Sevilla': 'https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg',
        'Valencia': 'https://upload.wikimedia.org/wikipedia/en/3/33/Valencia_CF_logo.svg',
        'Villarreal': 'https://upload.wikimedia.org/wikipedia/en/7/70/Villarreal_CF_logo.svg',
        'Athletic Bilbao': 'https://upload.wikimedia.org/wikipedia/en/0/0f/Athletic_Club_Bilbao_logo.svg',
        'Real Sociedad': 'https://upload.wikimedia.org/wikipedia/en/1/1f/Real_Sociedad_logo.svg',
        'Real Betis': 'https://upload.wikimedia.org/wikipedia/en/1/13/Real_Betis_logo.svg',
        'Celta Vigo': 'https://upload.wikimedia.org/wikipedia/en/4/43/RC_Celta_de_Vigo_logo.svg',
        
        // Bundesliga
        'Bayern Munich': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
        'Borussia Dortmund': 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
        'RB Leipzig': 'https://upload.wikimedia.org/wikipedia/en/0/04/RB_Leipzig_2014_logo.svg',
        'Bayer Leverkusen': 'https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg',
        'VfB Stuttgart': 'https://upload.wikimedia.org/wikipedia/en/6/6d/VfB_Stuttgart_logo.svg',
        'Eintracht Frankfurt': 'https://upload.wikimedia.org/wikipedia/en/0/04/Eintracht_Frankfurt_logo.svg',
        'Hoffenheim': 'https://upload.wikimedia.org/wikipedia/en/0/0d/TSG_1899_Hoffenheim_logo.svg',
        'SC Freiburg': 'https://upload.wikimedia.org/wikipedia/en/7/7d/SC_Freiburg_logo.svg',
        'VfL Wolfsburg': 'https://upload.wikimedia.org/wikipedia/en/f/f3/VfL_Wolfsburg_logo.svg',
        '1. FC Heidenheim': 'https://upload.wikimedia.org/wikipedia/en/8/81/1._FC_Heidenheim_1846_logo.svg',
        
        // Serie A
        'Inter Milan': 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_1908.svg',
        'AC Milan': 'https://upload.wikimedia.org/wikipedia/commons/d/d2/AC_Milan_logo.svg',
        'Juventus': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Juventus_Logo_2017_icon.svg',
        'Napoli': 'https://upload.wikimedia.org/wikipedia/en/2/2d/SSC_Napoli_logo.svg',
        'Atalanta': 'https://upload.wikimedia.org/wikipedia/en/5/57/Atalanta_BC_logo.svg',
        'Roma': 'https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282017%29.svg',
        'Lazio': 'https://upload.wikimedia.org/wikipedia/en/7/72/SS_Lazio_logo.svg',
        'Fiorentina': 'https://upload.wikimedia.org/wikipedia/en/2/2a/ACF_Fiorentina_logo.svg',
        'Bologna': 'https://upload.wikimedia.org/wikipedia/en/8/85/Bologna_FC_1909_logo.svg',
        'Torino': 'https://upload.wikimedia.org/wikipedia/en/1/1d/Torino_FC_Logo.svg',
        
        // MLS
        'LA Galaxy': 'https://upload.wikimedia.org/wikipedia/en/7/72/LA_Galaxy_logo.svg',
        'Seattle Sounders': 'https://upload.wikimedia.org/wikipedia/en/3/3a/Seattle_Sounders_FC_logo.svg',
        'Portland Timbers': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Portland_Timbers_logo.svg',
        'New York City FC': 'https://upload.wikimedia.org/wikipedia/en/2/2f/New_York_City_FC_logo.svg',
        'Atlanta United': 'https://upload.wikimedia.org/wikipedia/en/7/72/Atlanta_United_FC_logo.svg',
        'Toronto FC': 'https://upload.wikimedia.org/wikipedia/en/b/b3/Toronto_FC_logo.svg',
        'Sporting Kansas City': 'https://upload.wikimedia.org/wikipedia/en/8/8c/Sporting_Kansas_City_logo.svg',
        'Real Salt Lake': 'https://upload.wikimedia.org/wikipedia/en/4/4b/Real_Salt_Lake_logo.svg',
        'FC Dallas': 'https://upload.wikimedia.org/wikipedia/en/9/9f/FC_Dallas_logo.svg',
        'Houston Dynamo': 'https://upload.wikimedia.org/wikipedia/en/6/66/Houston_Dynamo_logo.svg'
    };
    
    // Try exact match first
    if (soccerLogos[teamName]) {
        return soccerLogos[teamName];
    }
    
    // Try flexible matching for common variations
    const teamVariations = {
        // Premier League variations
        'Man City': 'Manchester City',
        'Man United': 'Manchester United',
        'Man Utd': 'Manchester United',
        'Spurs': 'Tottenham Hotspur',
        'Tottenham': 'Tottenham Hotspur',
        'West Ham': 'West Ham United',
        'Newcastle': 'Newcastle United',
        'Nottingham': 'Nottingham Forest',
        'Sheffield': 'Sheffield United',
        'Wolverhampton': 'Wolves',
        
        // La Liga variations
        'Real': 'Real Madrid',
        'Barca': 'Barcelona',
        'Atletico': 'Atletico Madrid',
        'Athletic': 'Athletic Bilbao',
        'Sociedad': 'Real Sociedad',
        'Betis': 'Real Betis',
        'Celta': 'Celta Vigo',
        
        // Bundesliga variations
        'Bayern': 'Bayern Munich',
        'Dortmund': 'Borussia Dortmund',
        'Leipzig': 'RB Leipzig',
        'Leverkusen': 'Bayer Leverkusen',
        'Stuttgart': 'VfB Stuttgart',
        'Frankfurt': 'Eintracht Frankfurt',
        'Freiburg': 'SC Freiburg',
        'Wolfsburg': 'VfL Wolfsburg',
        'Heidenheim': '1. FC Heidenheim',
        
        // Serie A variations
        'Inter': 'Inter Milan',
        'Milan': 'AC Milan',
        'Juve': 'Juventus',
        'Roma': 'Roma',
        'Fiorentina': 'Fiorentina',
        'Bologna': 'Bologna',
        'Torino': 'Torino',
        
        // MLS variations
        'Galaxy': 'LA Galaxy',
        'Sounders': 'Seattle Sounders',
        'Timbers': 'Portland Timbers',
        'NYCFC': 'New York City FC',
        'Atlanta': 'Atlanta United',
        'Toronto': 'Toronto FC',
        'Sporting KC': 'Sporting Kansas City',
        'RSL': 'Real Salt Lake',
        'Dallas': 'FC Dallas',
        'Dynamo': 'Houston Dynamo'
    };
    
    // Check for variations
    for (const [shortName, fullName] of Object.entries(teamVariations)) {
        if (teamName.includes(shortName) || shortName.includes(teamName)) {
            console.log(`Found Soccer variation: ${teamName} -> ${fullName}`);
            return soccerLogos[fullName];
        }
    }
    
    // Try partial matching for remaining cases
    const teamNameLower = teamName.toLowerCase();
    for (const [fullName, logoUrl] of Object.entries(soccerLogos)) {
        const fullNameLower = fullName.toLowerCase();
        // Check if any word in the full name matches
        const fullNameWords = fullNameLower.split(' ');
        const teamNameWords = teamNameLower.split(' ');
        
        for (const word of teamNameWords) {
            if (word.length > 2 && fullNameWords.includes(word)) {
                console.log(`Found Soccer partial match: ${teamName} -> ${fullName} (via word: ${word})`);
                return logoUrl;
            }
        }
    }
    
    console.log(`No Soccer logo found for: ${teamName}`);
    return null;
}

// Get game time display with quarter/period info for live games
function getGameTimeDisplay(game) {
    if (game.status === 'live') {
        let periodInfo = '';
        
        // Add quarter/period information based on sport
        if (game.sport === 'nfl' || game.sport === 'ncaaf') {
            periodInfo = `Q${game.period || '1'}`;
        } else if (game.sport === 'nba' || game.sport === 'ncaab') {
            periodInfo = `Q${game.period || '1'}`;
        } else if (game.sport === 'mlb') {
            periodInfo = `${game.period || '1'}${game.topBottom === 'top' ? 'T' : 'B'}`;
        } else if (game.sport === 'nhl') {
            periodInfo = `P${game.period || '1'}`;
        } else if (game.sport === 'soccer') {
            periodInfo = `${game.period || '1'}H`;
        }
        
        // Add clock if available
        if (game.clock && game.clock !== '0:00') {
            return `${periodInfo} ${game.clock}`;
        } else {
            return periodInfo;
        }
    }
    
    // For non-live games, return the regular time
    return game.displayTime;
}
