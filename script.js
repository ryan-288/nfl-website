// Global variables
let currentDate = new Date();
let currentWeekOffset = 0;
let allScores = [];
let filteredScores = [];
let selectedSport = 'all';
let autoUpdateInterval;
let lastScoreHash = ''; // Track if scores actually changed
let hasLiveGames = false; // Track if there are live games
let logoCache = new Map(); // Cache for logo attempts (URL or 'FAILED')

// Debug function to log raw ESPN data for a specific game
function debugESPNData(gameIndex = 0) {
    if (!allScores || allScores.length === 0) {
        console.log('No games loaded');
        return;
    }
    
    const game = allScores[gameIndex];
    if (!game) {
        console.log(`Game ${gameIndex} not found`);
        return;
    }
    
    console.log('=== RAW ESPN DEBUG DATA ===');
    console.log(`Game: ${game.homeTeam} vs ${game.awayTeam}`);
    console.log('Raw ESPN event data:', window.rawESPNData?.events?.[gameIndex]);
    console.log('=== END ESPN DEBUG ===');
}

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
    // Force CSS reload to bypass caching issues
    forceCSSReload();
    
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    }
    
    // Check if running as PWA and apply appropriate styles
    checkPWAMode();
    
    // Check header visibility and force CSS reload if needed
    checkHeaderVisibility();
    
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

// Function to check PWA mode and apply appropriate styles
function checkPWAMode() {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                   window.navigator.standalone === true ||
                   document.referrer.includes('android-app://');
    
    console.log('PWA Mode detected:', isPWA);
    
    if (isPWA) {
        // Apply PWA-specific styles
        document.body.classList.add('pwa-mode');
        console.log('Applied PWA mode styles');
    } else {
        // Ensure normal mobile behavior
        document.body.classList.remove('pwa-mode');
        console.log('Applied normal mobile mode styles');
    }
}

// Function to check if header is visible and force CSS reload if needed
function checkHeaderVisibility() {
    const header = document.querySelector('.site-header');
    if (header) {
        const styles = window.getComputedStyle(header);
        const display = styles.display;
        const visibility = styles.visibility;
        const opacity = styles.opacity;
        
        console.log('Header visibility check:', {
            display: display,
            visibility: visibility,
            opacity: opacity,
            height: header.offsetHeight,
            width: header.offsetWidth
        });
        
        if (display === 'none' || visibility === 'hidden' || opacity === '0' || header.offsetHeight === 0) {
            console.log('Header not visible - forcing CSS reload');
            forceCSSReload();
        }
    } else {
        console.log('Header element not found');
    }
}

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
            // Use local date formatting to avoid timezone issues
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            customDateInput.value = `${year}-${month}-${day}`;
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
    
    // Set up frequent updates for live games (every 1 second)
    setInterval(() => {
        updateScoresIfNeeded();
    }, 1000); // Check every 1 second for live games
}

// Smart score update - refresh live games frequently
async function updateScoresIfNeeded() {
    try {
        // Always refresh if we have live games
        const liveGames = allScores.filter(game => game.status === 'live');
        hasLiveGames = liveGames.length > 0;
        
        if (hasLiveGames) {
            await loadAllScores(true); // Silent refresh
        } else {
            // No live games, refresh every 30 seconds
            const timeSinceLastUpdate = Date.now() - (window.lastUpdateTime || 0);
            if (timeSinceLastUpdate > 30000) { // 30 seconds
                await loadAllScores(true); // Silent refresh
            }
        }
    } catch (error) {
        console.error('Error in smart update:', error);
    }
}

// Auto-update indicator removed for silent operation

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

// Load all scores from ESPN APIs
async function loadAllScores(silent = false) {
    if (!silent) {
        console.log('Loading all scores...');
    }
    
    try {
        const scores = [];
        
        // Fetch scores from all sports concurrently
        const promises = Object.entries(ESPN_APIS).map(async ([sport, apiUrl]) => {
            try {
                console.log(`Fetching scores for sport: ${sport} from URL: ${apiUrl}`);
                const sportScores = await fetchScores(sport, sport);
                console.log(`Fetched ${sportScores.length} games for ${sport}`);
                return sportScores;
            } catch (error) {
                console.error(`Error fetching ${sport} scores:`, error);
                return [];
            }
        });
        
        const results = await Promise.allSettled(promises);
        
        // Combine all scores
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                scores.push(...result.value);
            }
        });
        
        console.log('Total scores fetched:', scores.length);
        
        // Fetch pitcher information for scheduled MLB games
        const scheduledMLBGames = scores.filter(game => game.sport === 'mlb' && game.status === 'scheduled');
        if (scheduledMLBGames.length > 0) {
            console.log(`Fetching pitcher info for ${scheduledMLBGames.length} scheduled MLB games`);
            
            // Fetch pitcher info for each scheduled MLB game
            const pitcherPromises = scheduledMLBGames.map(async (game) => {
                const pitcherInfo = await fetchMLBPitcherInfo(game.id);
                return { gameId: game.id, ...pitcherInfo };
            });
            
            const pitcherResults = await Promise.allSettled(pitcherPromises);
            
            // Update the scores with pitcher information
            pitcherResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const gameIndex = scores.findIndex(game => game.id === scheduledMLBGames[index].id);
                    if (gameIndex !== -1) {
                        scores[gameIndex].awayPitcher = result.value.awayPitcher;
                        scores[gameIndex].homePitcher = result.value.homePitcher;
                        console.log(`Updated pitcher info for game ${result.value.gameId}:`, result.value);
                    }
                }
            });
        }
        
        // Store the scores in the global variable
        allScores = scores;
        
        // Debug: Log all sports being processed
        const sportsCount = {};
        allScores.forEach(game => {
            sportsCount[game.sport] = (sportsCount[game.sport] || 0) + 1;
        });
        console.log('Sports breakdown:', sportsCount);
        
        // If no scores were fetched, show sample data for testing
        if (allScores.length === 0) {
            console.log('No scores fetched from APIs, showing sample data');
            allScores = getSampleData();
        } else {
            console.log('✅ Real scores fetched from ESPN APIs');
        }
        
        // After fetching all scores, apply the filter and update display
        console.log('Calling filterScores with', allScores.length, 'scores');
        filterScores();
        
        // Force a display update to ensure new data is shown
        if (silent) {
            console.log('Silent update - forcing display refresh');
            // Trigger a display update even for silent refreshes
            setTimeout(() => {
                filterScores();
            }, 100);
        }
        
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
        },
    ];
}

// Fetch pitcher information for a specific MLB game
async function fetchMLBPitcherInfo(gameId) {
    try {
        const apiUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
        console.log(`Fetching pitcher info from: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        console.log(`Pitcher API response for game ${gameId}:`, data);
        
        // Extract pitcher information from the game summary
        let awayPitcher = null;
        let homePitcher = null;
        
        if (data.boxscore && data.boxscore.teams) {
            const awayTeam = data.boxscore.teams.find(team => team.teamId === data.boxscore.teams[0].teamId);
            const homeTeam = data.boxscore.teams.find(team => team.teamId === data.boxscore.teams[1].teamId);
            
            // Look for probable pitchers in various locations
            if (awayTeam?.probablePitcher) {
                awayPitcher = awayTeam.probablePitcher.displayName || awayTeam.probablePitcher.name;
            }
            if (homeTeam?.probablePitcher) {
                homePitcher = homeTeam.probablePitcher.displayName || homeTeam.probablePitcher.name;
            }
        }
        
        return { awayPitcher, homePitcher };
    } catch (error) {
        console.error(`Error fetching pitcher info for game ${gameId}:`, error);
        return { awayPitcher: null, homePitcher: null };
    }
}

// Fetch scores from a specific sport API for the current date
async function fetchScores(sport, sportName) {
    try {
        // Format date as YYYYMMDD without timezone conversion
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateParam = `${year}${month}${day}`;
        const apiUrl = `${ESPN_APIS[sport]}?dates=${dateParam}`;
        
        console.log(`Fetching ${sport} scores from: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        console.log(`${sport} API response:`, data);
        
        // Store raw ESPN data for inspection
        if (sport === 'mlb') {
            window.rawESPNData = data;
            console.log('Stored raw ESPN data for inspection');
        }
        
        const parsedScores = parseESPNData(data, sport);
        console.log(`${sport} parsed scores:`, parsedScores);
        
        // Log MLB data specifically for debugging
        if (sport === 'mlb') {
            logMLBGameData(parsedScores);
            
            // Additional debugging: log raw ESPN API response for MLB
            console.log('=== RAW ESPN MLB API RESPONSE ===');
            if (data.events && data.events.length > 0) {
                data.events.forEach((event, index) => {
                    console.log(`Event ${index + 1}:`, {
                        name: event.name,
                        status: event.status,
                        sport: event.sport,
                        leagues: event.leagues,
                        competitions: event.competitions
                    });
                    
                    // Log detailed status information for MLB games
                    if (event.status) {
                        console.log(`  Status details for ${event.name}:`, {
                            state: event.status.type?.state,
                            description: event.status.type?.description,
                            shortDetail: event.status.type?.shortDetail,
                            detailedState: event.status.type?.detailedState,
                            period: event.status.period,
                            clock: event.status.clock
                        });
                        
                        // Additional debugging for MLB status fields
                        if (event.status.type) {
                            console.log(`  Full status.type object:`, event.status.type);
                        }
                    }
                });
            }
            console.log('=== END RAW MLB RESPONSE ===');
        }
        
        // Enhanced logging for live games
        const liveGames = parsedScores.filter(game => game.status === 'live');
        if (liveGames.length > 0) {
            console.log('=== LIVE GAMES DEBUG ===');
            liveGames.forEach((game, index) => {
                console.log(`Live Game ${index + 1}:`, {
                    sport: game.sport,
                    teams: `${game.awayTeam} vs ${game.homeTeam}`,
                    status: game.status,
                    period: game.period,
                    inningNumber: game.inningNumber,
                    topBottom: game.topBottom,
                    bases: game.bases,
                    outs: game.outs,
                    time: game.time,
                    displayTime: game.displayTime
                });
                
                // Additional logging for MLB games to debug bases/outs
                if (game.sport === 'mlb') {
                    console.log(`MLB Game ${index + 1} - Raw data:`, {
                        bases: game.bases,
                        outs: game.outs,
                        inningNumber: game.inningNumber,
                        topBottom: game.topBottom
                    });
                }
            });
            console.log('=== END LIVE GAMES DEBUG ===');
        }
        
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
        
        // Enhanced MLB inning detection
        let topBottom = null;
        let inningNumber = null;
        let bases = null;
        let outs = null;
        let balls = null;
        let strikes = null;
        
        // Store the previous inning state for better transitions
        let previousInningNumber = null;
        let previousTopBottom = null;
        
        // Debug: Log all available status information for MLB games
        if (sportKey === 'mlb') {
            console.log('=== MLB STATUS DEBUG ===');
            console.log('Full event status:', event.status);
            console.log('Status type:', event.status?.type);
            console.log('Status description:', event.status?.type?.description);
            console.log('Status shortDetail:', event.status?.type?.shortDetail);
            console.log('Status detailedState:', event.status?.type?.detailedState);
            console.log('Status period:', event.status?.period);
            console.log('Status clock:', event.status?.clock);
            console.log('Competition situation:', competition?.situation);
            
            // Log the entire competition object to see all available data
            console.log('Full competition object:', competition);
            
            // Log all possible fields that might contain inning information
            if (competition?.situation) {
                console.log('=== COMPETITION SITUATION DETAILS ===');
                const situation = competition.situation;
                console.log('All situation keys:', Object.keys(situation));
                console.log('All situation values:', Object.values(situation));
                
                // Log specific fields that commonly contain inning info
                console.log('situation.inning:', situation.inning);
                console.log('situation.topOfInning:', situation.topOfInning);
                console.log('situation.inningHalf:', situation.inningHalf);
                console.log('situation.inningState:', situation.inningState);
                console.log('situation.period:', situation.period);
                console.log('situation.quarter:', situation.quarter);
                console.log('situation.half:', situation.half);
                console.log('=== END COMPETITION SITUATION DETAILS ===');
            }
            
            // Log pitcher information for MLB games
            console.log('=== MLB PITCHER INFORMATION DEBUG ===');
            console.log('Full competition object keys:', Object.keys(competition || {}));
            console.log('Full event object keys:', Object.keys(event || {}));
            
            if (competition?.competitors) {
                competition.competitors.forEach((comp, index) => {
                    console.log(`Competitor ${index + 1} (${comp.homeAway}):`, {
                        teamName: comp.team?.name || comp.team?.displayName,
                        teamShortName: comp.team?.shortDisplayName,
                        probablePitcher: comp.probablePitcher,
                        pitcher: comp.pitcher,
                        starter: comp.starter,
                        allKeys: Object.keys(comp),
                        statistics: comp.statistics,
                        fullCompetitorObject: comp
                    });
                    
                    // Check for pitcher info in statistics
                    if (comp.statistics) {
                        const pitcherStats = comp.statistics.find(stat => 
                            stat.name?.toLowerCase().includes('pitcher') || 
                            stat.name?.toLowerCase().includes('starter')
                        );
                        if (pitcherStats) {
                            console.log(`Found pitcher stats:`, pitcherStats);
                        }
                    }
                });
            }
            
            // Check if pitcher info is in the event object itself
            console.log('Event keys that might contain pitcher info:', Object.keys(event).filter(key => 
                key.toLowerCase().includes('pitcher') || 
                key.toLowerCase().includes('starter') ||
                key.toLowerCase().includes('probable')
            ));
            
            console.log('=== END MLB PITCHER DEBUG ===');
            
            console.log('Raw event data:', event);
            console.log('Fetch timestamp:', new Date().toISOString());
            console.log('=== END MLB STATUS DEBUG ===');
        }
        
        // Debug: Log all available status information for football games
        if (sportKey === 'nfl' || sportKey === 'college-football') {
            console.log('=== FOOTBALL STATUS DEBUG ===');
            console.log('Full event status:', event.status);
            console.log('Status type:', event.status?.type);
            console.log('Status description:', event.status?.type?.description);
            console.log('Status shortDetail:', event.status?.type?.shortDetail);
            console.log('Status detailedState:', event.status?.type?.detailedState);
            console.log('Status period:', event.status?.period);
            console.log('Status clock:', event.status?.clock);
            console.log('Competition situation:', competition?.situation);
            console.log('=== END FOOTBALL STATUS DEBUG ===');
        }
        
        if (sportKey === 'mlb') {
            // Enhanced inning parsing with better logging
            console.log('=== MLB INNING PARSING DEBUG ===');
            console.log('Event status:', event.status);
            console.log('Event status type:', event.status?.type);
            console.log('Competition object:', competition);
            console.log('Competition situation:', competition?.situation);
            
            // Try to get inning info from status description first
            if (event.status?.type?.description) {
                const description = event.status.type.description.toLowerCase();
                console.log(`MLB status description: "${description}"`);
                
                // Enhanced inning state detection
                if (description.includes('top')) {
                    topBottom = 'top';
                    console.log('Found top from description');
                } else if (description.includes('bottom')) {
                    topBottom = 'bot';
                    console.log('Found bottom from description');
                } else if (description.includes('between') || description.includes('middle')) {
                    topBottom = 'mid';
                    console.log('Found between/middle from description');
                } else if (description.includes('end') || description.includes('ended')) {
                    topBottom = 'end';
                    console.log('Found end from description');
                } else if (description.includes('inning')) {
                    // Check if it's a transition state
                    if (description.includes('complete') || description.includes('finished')) {
                        topBottom = 'end';
                        console.log(`Found inning complete from description for inning ${inningNumber}`);
                    } else if (description.includes('break') || description.includes('pause')) {
                        topBottom = 'mid';
                        console.log(`Found inning break from description for inning ${inningNumber}`);
                    }
                }
                
                // Extract inning number from description (e.g., "Top 3rd", "Bottom 5th")
                const inningMatch = description.match(/(\d+)(?:st|nd|rd|th)/);
                if (inningMatch) {
                    inningNumber = parseInt(inningMatch[1]);
                    console.log(`Found inning number from description: ${inningNumber}`);
                }
            }
            
            // If no inning number from description, try to get it from period
            if (!inningNumber && event.status?.period) {
                inningNumber = event.status.period;
            }
            
            // Try to get inning info from other possible fields
            if (!inningNumber && event.status?.type?.shortDetail) {
                const shortDetail = event.status.type.shortDetail.toLowerCase();
                if (shortDetail.includes('inning')) {
                    const inningMatch = shortDetail.match(/(\d+)(?:st|nd|rd|th)/);
                    if (inningMatch) {
                        inningNumber = parseInt(inningMatch[1]);
                    }
                    // Check for top/bottom in shortDetail
                    if (!topBottom) {
                        if (shortDetail.includes('top')) topBottom = 'top';
                        else if (shortDetail.includes('bottom')) topBottom = 'bot';
                        else if (shortDetail.includes('between')) topBottom = 'mid';
                        else if (shortDetail.includes('end')) topBottom = 'end';
                    }
                }
            }
            
            // Check for inning info in detailedState
            if (!inningNumber && event.status?.type?.detailedState) {
                const detailedState = event.status.type.detailedState.toLowerCase();
                if (detailedState.includes('inning')) {
                    const inningMatch = detailedState.match(/(\d+)(?:st|nd|rd|th)/);
                    if (inningMatch) {
                        inningNumber = parseInt(inningMatch[1]);
                    }
                    // Check for top/bottom in detailedState
                    if (!topBottom) {
                        if (detailedState.includes('top')) topBottom = 'top';
                        else if (detailedState.includes('bottom')) topBottom = 'bot';
                        else if (detailedState.includes('between')) topBottom = 'mid';
                        else if (detailedState.includes('end')) topBottom = 'end';
                    }
                }
            }
            
            // Also check the main status description for inning info
            if (!inningNumber && event.status?.type?.description) {
                const description = event.status.type.description.toLowerCase();
                if (description.includes('inning')) {
                    const inningMatch = description.match(/(\d+)(?:st|nd|rd|th)/);
                    if (inningMatch) {
                        inningNumber = parseInt(inningMatch[1]);
                        console.log(`Found inning from main description: ${inningNumber}`);
                    }
                    // Check for top/bottom in main description
                    if (!topBottom) {
                        if (description.includes('top') || description.includes('1st')) topBottom = 'top';
                        else if (description.includes('bottom') || description.includes('2nd')) topBottom = 'bot';
                        else if (description.includes('between')) topBottom = 'mid';
                        else if (description.includes('end')) topBottom = 'end';
                    }
                }
            }
            
            // Try to get more reliable inning info from competition.situation object
            if (competition?.situation) {
                console.log(`MLB competition situation found:`, competition.situation);
                
                // Check if inning info is in the situation object
                if (competition.situation.inning !== undefined && competition.situation.inning !== null) {
                    inningNumber = competition.situation.inning;
                    console.log(`Found inning from situation: ${inningNumber}`);
                }
                
                // This is the most reliable source for top vs bottom
                if (competition.situation.topOfInning !== undefined && competition.situation.topOfInning !== null) {
                    topBottom = competition.situation.topOfInning ? 'top' : 'bot';
                    console.log(`Found topOfInning from situation: ${competition.situation.topOfInning} -> ${topBottom}`);
                }
                // Fallback to inningHalf
                else if (competition.situation.inningHalf !== undefined && competition.situation.inningHalf !== null) {
                    if (competition.situation.inningHalf === 1 || competition.situation.inningHalf === 'top') {
                        topBottom = 'top';
                    } else if (competition.situation.inningHalf === 2 || competition.situation.inningHalf === 'bottom') {
                        topBottom = 'bot';
                    }
                    console.log(`Found inningHalf: ${competition.situation.inningHalf} -> ${topBottom}`);
                }
                // Fallback to inningState
                else if (competition.situation.inningState !== undefined && competition.situation.inningState !== null) {
                    const state = competition.situation.inningState.toString().toLowerCase();
                    if (state.includes('top') || state === '1') {
                        topBottom = 'top';
                    } else if (state.includes('bottom') || state.includes('bot') || state === '2') {
                        topBottom = 'bot';
                    }
                    console.log(`Found inningState: ${competition.situation.inningState} -> ${topBottom}`);
                }
                
                // Additional fallback: Check for inning information in other fields
                if (!topBottom) {
                    console.log('No topBottom found in primary fields, checking additional sources...');
                    
                    // Check if there are any other fields that might indicate inning state
                    const situationKeys = Object.keys(competition.situation);
                    console.log('Available situation keys:', situationKeys);
                    
                    // Look for any field that might contain inning state information
                    for (const key of situationKeys) {
                        const value = competition.situation[key];
                        if (value !== null && value !== undefined) {
                            console.log(`Checking situation.${key}:`, value);
                            
                            // Check if this field contains inning state info
                            if (typeof value === 'string') {
                                const lowerValue = value.toLowerCase();
                                if (lowerValue.includes('top') || lowerValue.includes('1st')) {
                                    topBottom = 'top';
                                    console.log(`Found top from situation.${key}: ${value}`);
                                    break;
                                } else if (lowerValue.includes('bottom') || lowerValue.includes('2nd') || lowerValue.includes('bot')) {
                                    topBottom = 'bot';
                                    console.log(`Found bottom from situation.${key}: ${value}`);
                                    break;
                                } else if (lowerValue.includes('middle') || lowerValue.includes('mid')) {
                                    topBottom = 'mid';
                                    console.log(`Found middle from situation.${key}: ${value}`);
                                    break;
                                }
                            } else if (typeof value === 'number') {
                                // Some APIs use 1 for top, 2 for bottom
                                if (value === 1) {
                                    topBottom = 'top';
                                    console.log(`Found top from situation.${key} (numeric): ${value}`);
                                    break;
                                } else if (value === 2) {
                                    topBottom = 'bot';
                                    console.log(`Found bottom from situation.${key} (numeric): ${value}`);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Extract bases and outs from situation object
                if (competition.situation.outs !== undefined && competition.situation.outs !== null) {
                    outs = competition.situation.outs;
                    console.log(`Found outs from situation: ${outs}`);
                }
                
                if (competition.situation.balls !== undefined && competition.situation.balls !== null) {
                    balls = competition.situation.balls;
                    console.log(`Found balls from situation: ${balls}`);
                }
                
                if (competition.situation.strikes !== undefined && competition.situation.strikes !== null) {
                    strikes = competition.situation.strikes;
                    console.log(`Found strikes from situation: ${strikes}`);
                }
                
                // Extract bases from situation object
                let onFirst = competition.situation.onFirst;
                let onSecond = competition.situation.onSecond;
                let onThird = competition.situation.onThird;
                
                if (onFirst !== undefined || onSecond !== undefined || onThird !== undefined) {
                    if (onFirst && onSecond && onThird) {
                        bases = 'loaded';
                    } else if (onFirst && onSecond && !onThird) {
                        bases = '1st & 2nd';
                    } else if (onFirst && !onSecond && onThird) {
                        bases = '1st & 3rd';
                    } else if (!onFirst && onSecond && onThird) {
                        bases = '2nd & 3rd';
                    } else if (onFirst && !onSecond && !onThird) {
                        bases = '1st';
                    } else if (!onFirst && onSecond && !onThird) {
                        bases = '2nd';
                    } else if (!onFirst && !onSecond && onThird) {
                        bases = '3rd';
                    } else if (!onFirst && !onSecond && !onThird) {
                        bases = 'empty';
                    }
                    console.log(`Found bases from situation: ${bases}`);
                }
            }
            
            // Fallback: Try to extract bases and outs from status description if situation object didn't have the data
            if (event.status?.type?.description && (outs === null || bases === null)) {
                const description = event.status.type.description;
                console.log(`MLB parsing description (fallback): "${description}"`);
                
                // Look for outs (e.g., "2 outs", "0 outs")
                if (outs === null) {
                    const outsMatch = description.match(/(\d+)\s*out/);
                    if (outsMatch) {
                        outs = parseInt(outsMatch[1]);
                        console.log(`Found outs from description: ${outs}`);
                    }
                }
                
                // Look for bases loaded indicators
                if (bases === null) {
                    if (description.toLowerCase().includes('bases loaded')) {
                        bases = 'loaded';
                        console.log(`Found bases from description: loaded`);
                    } else if (description.toLowerCase().includes('runner on third')) {
                        bases = '3rd';
                        console.log(`Found bases from description: 3rd`);
                    } else if (description.toLowerCase().includes('runner on second')) {
                        bases = '2nd';
                        console.log(`Found bases from description: 2nd`);
                    } else if (description.toLowerCase().includes('runner on first')) {
                        bases = '1st';
                        console.log(`Found bases from description: 1st`);
                    } else if (description.toLowerCase().includes('runners on first and second')) {
                        bases = '1st & 2nd';
                        console.log(`Found bases from description: 1st & 2nd`);
                    } else if (description.toLowerCase().includes('runners on first and third')) {
                        bases = '1st & 3rd';
                        console.log(`Found bases from description: 1st & 3rd`);
                    } else if (description.toLowerCase().includes('runners on second and third')) {
                        bases = '2nd & 3rd';
                        console.log(`Found bases from description: 2nd & 3rd`);
                    }
                    // Additional base detection patterns
                    else if (description.toLowerCase().includes('man on first')) {
                        bases = '1st';
                        console.log(`Found bases from description: 1st (man on first)`);
                    } else if (description.toLowerCase().includes('man on second')) {
                        bases = '2nd';
                        console.log(`Found bases from description: 2nd (man on second)`);
                    } else if (description.toLowerCase().includes('man on third')) {
                        bases = '3rd';
                        console.log(`Found bases from description: 3rd (man on third)`);
                    } else if (description.toLowerCase().includes('men on first and second')) {
                        bases = '1st & 2nd';
                        console.log(`Found bases from description: 1st & 2nd (men on first and second)`);
                    } else if (description.toLowerCase().includes('men on first and third')) {
                        bases = '1st & 3rd';
                        console.log(`Found bases from description: 1st & 3rd (men on first and third)`);
                    } else if (description.toLowerCase().includes('men on second and third')) {
                        bases = '2nd & 3rd';
                        console.log(`Found bases from description: 2nd & 3rd (men on second and third)`);
                    } else {
                        console.log(`No base pattern matched in description: "${description}"`);
                    }
                    
                    // Try alternative patterns that might be used
                    if (!bases) {
                        if (description.toLowerCase().includes('first and second')) {
                            bases = '1st & 2nd';
                            console.log(`Found bases via alternative pattern: 1st & 2nd`);
                        } else if (description.toLowerCase().includes('first and third')) {
                            bases = '1st & 3rd';
                            console.log(`Found bases via alternative pattern: 1st & 3rd`);
                        } else if (description.toLowerCase().includes('second and third')) {
                            bases = '2nd & 3rd';
                            console.log(`Found bases via alternative pattern: 2nd & 3rd`);
                        }
                    }
                }
            } else if (!competition?.situation) {
                console.log('No competition.situation object found in MLB event');
            }
            
            // Also check shortDetail and detailedState for bases/outs info
            if (!outs && event.status?.type?.shortDetail) {
                const shortDetail = event.status.type.shortDetail;
                const outsMatch = shortDetail.match(/(\d+)\s*out/);
                if (outsMatch) {
                    outs = parseInt(outsMatch[1]);
                }
            }
            
            if (!outs && event.status?.type?.detailedState) {
                const detailedState = event.status.type.detailedState;
                const outsMatch = detailedState.match(/(\d+)\s*out/);
                if (outsMatch) {
                    outs = parseInt(outsMatch[1]);
                }
            }
            
            // If still no inning number, default to 1
            if (!inningNumber) {
                inningNumber = 1;
                console.log('No inning number found, defaulting to 1');
            }
            
            // If still no topBottom, try to infer from current state
            if (!topBottom) {
                // Check if we can infer from the description or other clues
                if (event.status?.type?.description) {
                    const desc = event.status.type.description.toLowerCase();
                    if (desc.includes('top') || desc.includes('1st')) {
                        topBottom = 'top';
                        console.log('Inferred top from description clues');
                    } else if (desc.includes('bottom') || desc.includes('2nd')) {
                        topBottom = 'bot';
                        console.log('Inferred bottom from description clues');
                    }
                }
                
                // If still no topBottom, default to top
                if (!topBottom) {
                    topBottom = 'top';
                    console.log('No topBottom found, defaulting to top');
                }
            }
            
            console.log(`MLB inning detection: inningNumber=${inningNumber}, topBottom=${topBottom}, bases=${bases}, outs=${outs}`);
            console.log('=== END MLB INNING PARSING DEBUG ===');
        }
        
        // Extract possession/at-bat information
        let possessionTeam = null;
        let atBatTeam = null;
        let awayTeamId = null;
        let homeTeamId = null;
        let awayTeamRecord = null;
        let homeTeamRecord = null;
        let ballOn = null;

        if (sportKey === 'nfl' || sportKey === 'college-football') {
            // For football, check if there's possession data in the situation
            if (competition?.situation?.possession) {
                possessionTeam = competition.situation.possession;
                console.log(`Football possession: ${possessionTeam}`);
            }
            
            // Extract ball location data
            if (competition?.situation?.ballOn) {
                ballOn = competition.situation.ballOn;
                console.log(`Football ball location: ${ballOn}`);
            }
            
            // Extract team IDs for possession comparison
            if (competition?.competitors) {
                const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
                const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
                if (awayTeam?.id) awayTeamId = awayTeam.id;
                if (homeTeam?.id) homeTeamId = homeTeam.id;
                console.log(`Football team IDs - Away: ${awayTeamId}, Home: ${homeTeamId}`);
            }
            // Log all available football data for debugging
            console.log(`=== FOOTBALL DATA DEBUG ===`);
            console.log('Competition situation:', competition?.situation);
            console.log('Event status:', event.status);
            console.log('Event status type:', event.status?.type);
            console.log('Event status description:', event.status?.type?.description);
            console.log('Event status shortDetail:', event.status?.type?.shortDetail);
            console.log('Event status detailedState:', event.status?.type?.detailedState);
            console.log('Event status period:', event.status?.period);
            console.log('Event status clock:', event.status?.clock);
            console.log('Raw event data:', event);
            console.log(`=== END FOOTBALL DATA DEBUG ===`);
            // Try alternative possession indicators
            if (!possessionTeam && competition?.situation?.ballOn) {
                // Sometimes possession is indicated by which side of the field the ball is on
                const ballOn = competition.situation.ballOn;
                console.log(`Football ball location: ${ballOn}`);
                // This might help determine possession
            }
            if (!possessionTeam && event.status?.type?.description) {
                const description = event.status.type.description.toLowerCase();
                // Look for possession indicators in the description
                if (description.includes('possession') || description.includes('ball')) {
                    console.log(`Football description suggests possession info: ${description}`);
                }
            }
        } else if (sportKey === 'mlb') {
            // For baseball, the team at bat is determined by top/bottom of inning
            if (topBottom === 'top') {
                atBatTeam = 'away'; // Away team bats in top of inning
            } else if (topBottom === 'bot') {
                atBatTeam = 'home'; // Home team bats in bottom of inning
            }
            console.log(`MLB at bat: ${atBatTeam} (${topBottom} of inning)`);
        }

        // Extract team records for all sports
        if (competition?.competitors) {
            const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
            const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
            
            // Extract team records from various possible locations
            if (awayTeam?.records && awayTeam.records.length > 0) {
                // Look for overall record first
                const overallRecord = awayTeam.records.find(r => r.type === 'overall' || r.type === 'total');
                if (overallRecord) {
                    awayTeamRecord = overallRecord.summary;
                    console.log(`Away team record found: ${awayTeamRecord}`);
                }
            }
            
            if (homeTeam?.records && homeTeam.records.length > 0) {
                // Look for overall record first
                const overallRecord = homeTeam.records.find(r => r.type === 'overall' || r.type === 'total');
                if (overallRecord) {
                    homeTeamRecord = overallRecord.summary;
                    console.log(`Home team record found: ${homeTeamRecord}`);
                }
            }
            
            // Fallback: try to get records from team stats if available
            if (!awayTeamRecord && awayTeam?.statistics) {
                const wins = awayTeam.statistics.find(s => s.name === 'wins')?.value;
                const losses = awayTeam.statistics.find(s => s.name === 'losses')?.value;
                if (wins !== undefined && losses !== undefined) {
                    awayTeamRecord = `${wins}-${losses}`;
                    console.log(`Away team record from stats: ${awayTeamRecord}`);
                }
            }
            
            if (!homeTeamRecord && homeTeam?.statistics) {
                const wins = homeTeam.statistics.find(s => s.name === 'wins')?.value;
                const losses = homeTeam.statistics.find(s => s.name === 'losses')?.value;
                if (wins !== undefined && losses !== undefined) {
                    homeTeamRecord = `${wins}-${losses}`;
                    console.log(`Home team record from stats: ${homeTeamRecord}`);
                }
            }
        }

        // Extract starting pitcher information for MLB games
        let awayPitcher = null;
        let homePitcher = null;
        
        if (sportKey === 'mlb' && competition?.competitors) {
            const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
            const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
            
            // Try multiple possible locations for pitcher information
            if (awayTeam) {
                awayPitcher = awayTeam.probablePitcher?.displayName || 
                             awayTeam.probablePitcher?.name ||
                             awayTeam.pitcher?.displayName ||
                             awayTeam.pitcher?.name ||
                             awayTeam.starter?.displayName ||
                             awayTeam.starter?.name;
                
                if (awayPitcher) {
                    console.log(`Away team pitcher found: ${awayPitcher}`);
                } else {
                    console.log('No away team pitcher found in API response');
                }
            }
            
            if (homeTeam) {
                homePitcher = homeTeam.probablePitcher?.displayName || 
                             homeTeam.probablePitcher?.name ||
                             homeTeam.pitcher?.displayName ||
                             homeTeam.pitcher?.name ||
                             homeTeam.starter?.displayName ||
                             homeTeam.starter?.name;
                
                if (homePitcher) {
                    console.log(`Home team pitcher found: ${homePitcher}`);
                } else {
                    console.log('No home team pitcher found in API response');
                }
            }
            
            // Note: ESPN API scoreboard endpoint doesn't include pitcher information
            // This would need to be fetched from a different API endpoint or data source
        }

        // Extract team names and clean them for display
        // Use shortDisplayName for all sports to show shorter team names
        let awayTeamName = awayTeam.team?.shortDisplayName || awayTeam.team?.name || awayTeam.team?.displayName || 'TBD';
        let homeTeamName = homeTeam.team?.shortDisplayName || homeTeam.team?.name || homeTeam.team?.displayName || 'TBD';
        
        // Debug: Log what we're getting from the API
        if (sportKey === 'college-football') {
            console.log(`🔍 Raw API data for team names:`);
            console.log(`  Away - name: "${awayTeam.team?.name}", displayName: "${awayTeam.team?.displayName}", shortDisplayName: "${awayTeam.team?.shortDisplayName}", abbreviation: "${awayTeam.team?.abbreviation}"`);
            console.log(`  Home - name: "${homeTeam.team?.name}", displayName: "${homeTeam.team?.displayName}", shortDisplayName: "${homeTeam.team?.shortDisplayName}", abbreviation: "${homeTeam.team?.abbreviation}"`);
            console.log(`  Full away team object:`, JSON.stringify(awayTeam.team, null, 2));
            console.log(`  Full home team object:`, JSON.stringify(homeTeam.team, null, 2));
        }
        
        // Clean team names for college football to show just the school name
        if (sportKey === 'college-football') {
            console.log(`🧹 Cleaning team names:`);
            console.log(`  Away: "${awayTeamName}" -> "${cleanCollegeFootballTeamName(awayTeamName)}"`);
            console.log(`  Home: "${homeTeamName}" -> "${cleanCollegeFootballTeamName(homeTeamName)}"`);
            const originalAway = awayTeamName;
            const originalHome = homeTeamName;
            awayTeamName = cleanCollegeFootballTeamName(awayTeamName);
            homeTeamName = cleanCollegeFootballTeamName(homeTeamName);
            
            // Debug: Check if cleaning changed the names
            if (originalAway !== awayTeamName) {
                console.log(`🔄 Away team name changed: "${originalAway}" -> "${awayTeamName}"`);
            }
            if (originalHome !== homeTeamName) {
                console.log(`🔄 Home team name changed: "${originalHome}" -> "${homeTeamName}"`);
            }
        }
        
        // Debug: Log team names for college football
        if (sportKey === 'college-football') {
            console.log(`🏈 College Football game found:`);
            console.log(`  Away: "${awayTeamName}" (raw name: ${awayTeam.team?.name || 'undefined'}, displayName: ${awayTeam.team?.displayName || 'undefined'}, shortDisplayName: ${awayTeam.team?.shortDisplayName || 'undefined'})`);
            console.log(`  Home: "${homeTeamName}" (raw name: ${homeTeam.team?.name || 'undefined'}, displayName: ${homeTeam.team?.displayName || 'undefined'}, shortDisplayName: ${homeTeam.team?.shortDisplayName || 'undefined'})`);
            console.log(`  Away team object:`, awayTeam.team);
            console.log(`  Home team object:`, homeTeam.team);
            console.log(`  Away team abbreviation:`, awayTeam.team?.abbreviation);
            console.log(`  Home team abbreviation:`, homeTeam.team?.abbreviation);
        }
        
        const parsedGame = {
            id: event.id,
            sport: sportKey,
            awayTeam: awayTeamName,
            homeTeam: homeTeamName,
            awayScore: awayTeam.score || '0',
            homeScore: homeTeam.score || '0',
            status: status,
            period: event.status?.period || null,
            clock: event.status?.clock || null,
            inning: inningNumber,
            topBottom: topBottom,
            inningNumber: inningNumber,
            bases: bases,
            outs: outs,
            balls: balls,
            strikes: strikes,
            possessionTeam: possessionTeam,
            atBatTeam: atBatTeam,
            awayTeamId: awayTeamId,
            homeTeamId: homeTeamId,
            awayTeamRecord: awayTeamRecord,
            homeTeamRecord: homeTeamRecord,
            awayPitcher: awayPitcher,
            homePitcher: homePitcher,
            time: getLiveGameTime(event),
            displayDate: displayDateTime.date,
            displayTime: displayDateTime.time,
            fullDateTime: event.date,
            gameDate: event.date,
            ballOn: ballOn
        };
        
        // Debug logging for MLB games
        if (sportKey === 'mlb') {
            console.log('=== MLB GAME OBJECT DEBUG ===');
            console.log('Game:', parsedGame.awayTeam, 'vs', parsedGame.homeTeam);
            console.log('Inning number:', parsedGame.inningNumber);
            console.log('Top/bottom:', parsedGame.topBottom);
            console.log('Status:', parsedGame.status);
            console.log('=== END MLB GAME OBJECT DEBUG ===');
        }
        
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
        description.toLowerCase().includes('final/ot') ||
        (period && period > 9 && !clock && state !== 'in')) {
        console.log('Game is finished');
        return 'final';
    }
    
    // Check if game is live/in progress - improved MLB detection
    if (state === 'in' && (
        description.toLowerCase().includes('quarter') ||
        description.toLowerCase().includes('period') ||
        description.toLowerCase().includes('inning') ||
        description.toLowerCase().includes('top') ||
        description.toLowerCase().includes('bottom') ||
        description.toLowerCase().includes('live') ||
        (period && period > 0) ||
        (clock && clock !== '0:00' && clock !== '' && clock !== '0'))) {
        console.log('Game is live');
        return 'live';
    }
    
    // Special handling for MLB games that might be in progress
    if (event.sport && event.sport.toLowerCase().includes('baseball') || 
        event.leagues && event.leagues[0] && event.leagues[0].slug === 'mlb') {
        // Use enhanced MLB detection
        if (isMLBGameLive(event)) {
            console.log('MLB game detected as live by enhanced detection');
            return 'live';
        }
        // Check if there's any period/inning info that suggests live play
        if (period && period > 0) {
            console.log('MLB game with period > 0, treating as live');
            return 'live';
        }
        // Check if there are scores that suggest the game has started
        const competition = event.competitions?.[0];
        if (competition && competition.competitors) {
            const hasScores = competition.competitors.some(comp => 
                comp.score && comp.score !== '0' && comp.score !== '');
            if (hasScores && state === 'in') {
                console.log('MLB game with scores and state "in", treating as live');
                return 'live';
            }
        }
        // For MLB, if state is 'in' and we have any competition data, treat as live
        if (state === 'in' && competition) {
            console.log('MLB game with state "in" and competition data, treating as live');
            return 'live';
        }
        // Additional MLB live detection: check if description contains inning info
        if (state === 'in' && description && (
            description.toLowerCase().includes('inning') ||
            description.toLowerCase().includes('top') ||
            description.toLowerCase().includes('bottom'))) {
            console.log('MLB game with inning description, treating as live');
            return 'live';
        }
    }
    
    // Check if game is scheduled/upcoming
    if (state === 'pre' || 
        description.toLowerCase().includes('scheduled') ||
        description.toLowerCase().includes('upcoming') ||
        description.toLowerCase().includes('pregame') ||
        description.toLowerCase().includes('delayed')) {
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
    
    // For live games, return the raw data - let getGameTimeDisplay format it
    if (status.type?.state === 'in') {
        // For MLB games, try to get more specific inning information
        if (event.leagues && event.leagues[0] && event.leagues[0].slug === 'mlb') {
            // Check if we have detailed MLB status info
            if (description && description.toLowerCase().includes('inning')) {
                return description;
            }
            // Check for top/bottom inning info
            if (period && (description.toLowerCase().includes('top') || description.toLowerCase().includes('bottom'))) {
                return `${period}${description.toLowerCase().includes('top') ? 'T' : 'B'}`;
            }
            // If we have period but no description, create inning info
            if (period && period > 0) {
                const topBottom = description.toLowerCase().includes('bottom') ? 'B' : 'T';
                return `${period}${topBottom}`;
            }
        }
        return 'Live';
    }
    
    // For non-live games, return the description or status
    if (description) {
        return description;
    }
    
    return 'Scheduled';
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
        
        // Debug pitcher information for scheduled MLB games
        if (game.sport === 'mlb' && game.status === 'scheduled') {
            console.log(`MLB scheduled game: ${game.awayTeam} vs ${game.homeTeam}`);
            console.log(`Away pitcher: ${game.awayPitcher || 'Not available'}, Home pitcher: ${game.homePitcher || 'Not available'}`);
        }
        
        // Get team logos
    if (game.sport === 'college-football') {
        console.log(`🎯 Getting logos for real college football game:`);
        console.log(`  Away team: "${game.awayTeam}"`);
        console.log(`  Home team: "${game.homeTeam}"`);
    }
    
    const awayLogo = getTeamLogo(game.awayTeam, game.sport);
    const homeLogo = getTeamLogo(game.homeTeam, game.sport);
    
    // Debug cache after getting logos
    if (game.sport === 'college-football') {
        console.log(`Cache status after getting logos:`);
        console.log(`  Away: ${logoCache.has(`${game.sport}-${game.awayTeam}`) ? 'cached' : 'not cached'}`);
        console.log(`  Home: ${logoCache.has(`${game.sport}-${game.homeTeam}`) ? 'cached' : 'not cached'}`);
    }
        
        return `
            <div class="score-card ${changeClass}" data-game-id="${game.sport}-${game.awayTeam}-${game.homeTeam}">
                <div class="game-header">
                    <span class="sport-type">${game.sport}</span>
                    ${game.sport === 'mlb' && game.status === 'live' && game.inningNumber ? `<span class="inning-display live">${getInningDisplay(game)}</span>` : ''}
                    ${game.sport === 'mlb' && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
                    ${(game.sport === 'nfl' || game.sport === 'college-football') && game.status === 'live' && game.period ? `<span class="inning-display live">${getFootballDisplay(game)}</span>` : ''}
                    ${(game.sport === 'nfl' || game.sport === 'college-football') && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
                    ${(game.sport === 'nba' || game.sport === 'ncaab') && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
                    ${(game.sport === 'nhl') && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
                    ${(game.sport === 'soccer') && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
                    ${game.status === 'scheduled' ? `<span class="inning-display scheduled">${game.displayTime || game.time || 'TBD'}</span>` : ''}
                </div>
                <div class="game-content">
                    <div class="teams">
                        <div class="team ${getWinner(game) === 'away' ? 'winner' : ''} ${getTeamHighlightClass(game, 'away')}">
                            <div class="team-info">
                                <div class="team-logo">
                                    ${awayLogo}
                                </div>
                                <div class="team-details">
                                    <span class="team-name">${game.awayTeam}</span>
                                    ${game.awayTeamRecord ? `<span class="team-record">${game.awayTeamRecord}</span>` : ''}
                                    ${game.sport === 'mlb' && game.status === 'scheduled' && game.awayPitcher ? `<span class="pitcher-info">${game.awayPitcher}</span>` : ''}
                                </div>
                            </div>
                            <span class="team-score ${game.status === 'scheduled' ? 'scheduled' : ''}">
                                ${game.status === 'scheduled' ? '' : game.awayScore}
                            </span>
                        </div>
                        <div class="team ${getWinner(game) === 'home' ? 'winner' : ''} ${getTeamHighlightClass(game, 'home')}">
                            <div class="team-info">
                                <div class="team-logo">
                                    ${homeLogo}
                                </div>
                                <div class="team-details">
                                    <span class="team-name">${game.homeTeam}</span>
                                    ${game.homeTeamRecord ? `<span class="team-record">${game.homeTeamRecord}</span>` : ''}
                                    ${game.sport === 'mlb' && game.status === 'scheduled' && game.homePitcher ? `<span class="pitcher-info">${game.homePitcher}</span>` : ''}
                                </div>
                            </div>
                            <span class="team-score ${game.status === 'scheduled' ? 'scheduled' : ''}">
                                ${game.status === 'scheduled' ? '' : game.homeScore}
                            </span>
                        </div>
                    </div>
                    
                    ${game.sport === 'nfl' && game.status === 'live' ? '' : ''}
                    
                    ${game.sport === 'mlb' && game.status === 'live' ? `<div class="mlb-game-state">
                        <div class="mlb-bases-container">
                            ${game.bases ? getBasesVisual(game.bases) : ''}
                        </div>
                        <div class="mlb-count-container">
                            ${getCountDotsVisual(game)}
                        </div>
                    </div>` : ''}
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

// Force CSS reload to bypass caching issues
function forceCSSReload() {
    const cssLink = document.querySelector('link[href*="styles.css"]');
    if (cssLink) {
        const timestamp = new Date().getTime();
        const newHref = cssLink.href.split('?')[0] + '?v=' + timestamp;
        cssLink.href = newHref;
        console.log('Forced CSS reload with timestamp:', timestamp);
    }
    
    // Also clear service worker caches if available
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                if (cacheName.includes('sports-scores')) {
                    caches.delete(cacheName);
                    console.log('Cleared cache:', cacheName);
                }
            });
        });
    }
}

// Function to force refresh and clear all caches
function forceRefresh() {
    console.log('Force refreshing page and clearing caches...');
    
    // Clear service worker caches
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
                console.log('Cleared cache:', cacheName);
            });
        });
    }
    
    // Unregister service worker to force fresh start
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
                registration.unregister();
                console.log('Unregistered service worker');
            });
        });
    }
    
    // Force page reload
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
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
    
    // Check if score changed, status changed, or inning changed
    const scoreChanged = previousGame.awayScore !== newGame.awayScore || 
                        previousGame.homeScore !== newGame.homeScore ||
                        previousGame.status !== newGame.status ||
                        previousGame.inningNumber !== newGame.inningNumber ||
                        previousGame.topBottom !== newGame.topBottom;
    
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
    // Format date as YYYY-MM-DD without timezone conversion
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    document.getElementById('customDate').value = `${year}-${month}-${day}`;
    
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
    // Format date as YYYY-MM-DD without timezone conversion
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    document.getElementById('customDate').value = `${year}-${month}-${day}`;
    
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
    // Format date as YYYY-MM-DD without timezone conversion
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    document.getElementById('customDate').value = `${year}-${month}-${day}`;
    
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

// Function to open the date picker directly
function toggleDatePicker() {
    const dateInput = document.getElementById('customDate');
    // Immediately open the native date picker
    dateInput.showPicker ? dateInput.showPicker() : dateInput.click();
}

function goToCustomDate(dateString) {
    if (!dateString) return;
    
    // Parse the date string and create a local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    currentDate = new Date(year, month - 1, day, 12, 0, 0); // Set to noon local time to avoid timezone issues
    
    console.log('Selected date string:', dateString);
    console.log('Parsed date:', currentDate);
    console.log('Current date object:', currentDate.toDateString());
    
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
    
    // Hide the date input after selection
    const dateInput = document.getElementById('customDate');
    dateInput.style.display = 'none';
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

// Refresh only MLB scores for debugging
async function refreshMLBScores() {
    console.log('Manually refreshing MLB scores...');
    try {
        const mlbScores = await fetchScores('mlb', 'MLB');
        console.log('MLB scores fetched:', mlbScores);
        
        // Update the global scores array with new MLB data
        const otherScores = allScores.filter(game => game.sport !== 'mlb');
        allScores = [...otherScores, ...mlbScores];
        
        // Apply filters and update display
        filterScores();
        
        // Show update indicator
        showAutoUpdateIndicator();
        
        // Test inning display after refresh
        setTimeout(() => {
            testMLBInningDisplay();
        }, 1000);
        
        console.log('MLB scores refreshed successfully');
    } catch (error) {
        console.error('Error refreshing MLB scores:', error);
    }
}

// Update current date display
function updateCurrentDateDisplay() {
    const dateText = document.getElementById('currentDateDisplay');
    if (!dateText) return;
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const displayDate = currentDate.toLocaleDateString('en-US', options);
    dateText.textContent = displayDate;
}

// Auto-refresh every 5 seconds for live data
setInterval(() => {
    if (allScores.length > 0) {
        loadAllScores();
    }
}, 5000); // 5 seconds

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
    console.log(`Sport type check - is college-football? ${sport === 'college-football'}`);
    
    // Check cache first
    const cacheKey = `${sport}-${teamName}`;
    if (logoCache.has(cacheKey)) {
        const cachedResult = logoCache.get(cacheKey);
        console.log(`Using cached logo result for ${teamName}: ${cachedResult === 'FAILED' ? 'Failed' : 'URL found'}`);
        if (cachedResult && cachedResult !== 'FAILED') {
            return createLogoHTML(teamName, sport, cachedResult);
        } else {
            return createFallbackLogo(teamName, sport);
        }
    }
    
    // Try to get logo from working sources
    const logoUrl = getWorkingLogoUrl(teamName, sport);
    console.log(`Logo URL generated: ${logoUrl}`);
    
    if (logoUrl) {
        console.log(`Logo HTML generated for ${teamName}`);
        return createLogoHTML(teamName, sport, logoUrl);
    } else {
        // Cache the failure
        logoCache.set(cacheKey, 'FAILED');
        console.log(`No logo URL found for ${teamName}, using fallback`);
        return createFallbackLogo(teamName, sport);
    }
}

// Create logo HTML with proper error handling
function createLogoHTML(teamName, sport, logoUrl) {
    const cacheKey = `${sport}-${teamName}`;
    
    return `
        <img src="${logoUrl}" alt="${teamName}" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'; logoCache.set('${cacheKey}', 'FAILED'); this.onerror=null;" 
             onload="this.style.display='block'; this.nextElementSibling.style.display='none'; logoCache.set('${cacheKey}', '${logoUrl}');"
             style="width: 100%; height: 100%; border-radius: 50%; object-fit: contain; display: block;" />
        <div class="fallback-logo" style="display: none; background: ${getFallbackColor(sport)}; width: 100%; height: 100%; border-radius: 50%; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${getTeamInitials(teamName)}</div>
    `;
}

// Create fallback logo
function createFallbackLogo(teamName, sport) {
    return `<div class="fallback-logo" style="background: ${getFallbackColor(sport)}; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${getTeamInitials(teamName)}</div>`;
}

// Check if a logo URL is from a known working source
function isKnownWorkingLogoUrl(url) {
    if (!url) return false;
    
    // ESPN URLs are generally reliable
    if (url.includes('espncdn.com')) return true;
    
    // Other known working patterns
    if (url.includes('sportslogos.net')) return true;
    if (url.includes('logos-world.net')) return true;
    if (url.includes('teamlogos.net')) return true;
    if (url.includes('cdn.sportlogos.net')) return true;
    
    // Allow any URL that looks like a valid image URL
    if (url.startsWith('http') && (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.svg'))) {
        return true;
    }
    
    // If it's not a known pattern, be conservative and cache as failed
    return false;
}

// Clear logo cache (useful for debugging)
function clearLogoCache() {
    logoCache.clear();
    console.log('Logo cache cleared');
}

// Get logo cache stats
function getLogoCacheStats() {
    const stats = {
        total: logoCache.size,
        successful: 0,
        failed: 0
    };
    
    for (const [key, value] of logoCache.entries()) {
        if (value === 'FAILED') {
            stats.failed++;
        } else {
            stats.successful++;
        }
    }
    
    console.log('Logo Cache Stats:', stats);
    return stats;
}

// Make cache accessible for debugging
window.logoCache = logoCache;
window.clearLogoCache = clearLogoCache;
window.getLogoCacheStats = getLogoCacheStats;

// Function to test ESPN API response structure
window.testESPNResponse = async function() {
    try {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const day = String(new Date().getDate()).padStart(2, '0');
        const dateParam = `${year}${month}${day}`;
        const apiUrl = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${dateParam}`;
        
        console.log('Testing ESPN API response structure...');
        console.log('URL:', apiUrl);
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        console.log('=== ESPN API RESPONSE STRUCTURE ===');
        console.log('Total events:', data.events?.length || 0);
        
        if (data.events && data.events.length > 0) {
            const firstEvent = data.events[0];
            console.log('First event structure:', firstEvent);
            
            if (firstEvent.competitions && firstEvent.competitions[0] && firstEvent.competitions[0].competitors) {
                const competitors = firstEvent.competitions[0].competitors;
                console.log('Competitors structure:', competitors);
                
                competitors.forEach((comp, index) => {
                    console.log(`Competitor ${index}:`, comp);
                    console.log(`  Team object:`, comp.team);
                    console.log(`  Team name:`, comp.team?.name);
                    console.log(`  Team displayName:`, comp.team?.displayName);
                    console.log(`  Team shortDisplayName:`, comp.team?.shortDisplayName);
                    console.log(`  Team abbreviation:`, comp.team?.abbreviation);
                    console.log(`  Home/Away:`, comp.homeAway);
                });
            }
        }
        console.log('=== END ESPN API RESPONSE STRUCTURE ===');
        
        return data;
    } catch (error) {
        console.error('Error testing ESPN API:', error);
    }
};

// Clear cache on page load to start fresh
clearLogoCache();

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
    } else if (sport === 'college-football') {
        console.log(`College Football logo lookup for: ${teamName}`);
        console.log(`🔍 Looking up logo for cleaned team name: "${teamName}"`);
        const collegeFootballUrl = getCollegeFootballLogoUrl(teamName);
        console.log(`College Football URL result: ${collegeFootballUrl}`);
        if (collegeFootballUrl) {
            console.log(`✅ College Football logo found for ${teamName}: ${collegeFootballUrl}`);
        } else {
            console.log(`❌ No College Football logo found for ${teamName}`);
            console.log(`🔍 Team name "${teamName}" not found in logo database`);
        }
        return collegeFootballUrl;
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

// Get College Football logo URLs with comprehensive team database
function getCollegeFootballLogoUrl(teamName) {
    console.log(`🔍 College Football logo search for: "${teamName}"`);
    
    const collegeFootballLogos = {
        // Power 5 Conferences - SEC
        'Alabama': 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
        'Auburn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
        'Florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
        'Georgia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
        'Kentucky': 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
        'LSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
        'Mississippi State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
        'Missouri': 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
        'Ole Miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        'South Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
        'Tennessee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
        'Texas A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        'Vanderbilt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png',
        'Arkansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
        
        // Power 5 Conferences - Big Ten
        'Ohio State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
        'Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
        'Penn State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        'Wisconsin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
        'Iowa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
        'Michigan State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
        'Nebraska': 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png',
        'Minnesota': 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png',
        'Northwestern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/77.png',
        'Purdue': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
        'Indiana': 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
        'Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
        'Maryland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
        'Rutgers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
        
        // Power 5 Conferences - ACC
        'Clemson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
        'Florida State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
        'Miami': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        'Virginia Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
        'North Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
        'NC State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png',
        'Duke': 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png',
        'Wake Forest': 'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png',
        'Boston College': 'https://a.espncdn.com/i/teamlogos/ncaa/500/103.png',
        'Louisville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png',
        'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
        'Syracuse': 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
        'Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
        'Georgia Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png',
        
        // Power 5 Conferences - Big 12
        'Texas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        'Oklahoma': 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
        'Oklahoma State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
        'TCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png',
        'Baylor': 'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png',
        'Kansas State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
        'Iowa State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
        'Kansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
        'West Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png',
        'Texas Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
        'BYU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png',
        'Cincinnati': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png',
        'Houston': 'https://a.espncdn.com/i/teamlogos/ncaa/500/248.png',
        'UCF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2116.png',
        
        // Power 5 Conferences - Pac-12
        'USC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
        'UCLA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/26.png',
        'Oregon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
        'Washington': 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
        'Stanford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
        'California': 'https://a.espncdn.com/i/teamlogos/ncaa/500/25.png',
        'Arizona': 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png',
        'Arizona State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'Utah': 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png',
        'Colorado': 'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png',
        'Oregon State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        'Washington State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        
        // Other Notable Programs
        'Notre Dame': 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        'Army': 'https://a.espncdn.com/i/teamlogos/ncaa/500/349.png',
        'Navy': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png',
        'Air Force': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'Boise State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/68.png',
        'Memphis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/235.png',
        'SMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png',
        'Tulane': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png',
        'Liberty': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2335.png',
        'Appalachian State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
        'Coastal Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png',
        'Marshall': 'https://a.espncdn.com/i/teamlogos/ncaa/500/276.png',
        'Western Kentucky': 'https://a.espncdn.com/i/teamlogos/ncaa/500/98.png',
        'Troy': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2653.png',
        'South Alabama': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6.png',
        'Louisiana': 'https://a.espncdn.com/i/teamlogos/ncaa/500/309.png',
        'Louisiana Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2348.png',
        'Southern Miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png',
        'Arkansas State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        'Texas State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/326.png',
        'UTSA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2636.png',
        'North Texas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/249.png',
        'Rice': 'https://a.espncdn.com/i/teamlogos/ncaa/500/242.png',
        'Charlotte': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png',
        'Florida Atlantic': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2226.png',
        'FIU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2229.png',
        'Middle Tennessee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2393.png',
        'Old Dominion': 'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
        'James Madison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png',
        'Georgia State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png',
        'Georgia Southern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2240.png',
        'Temple': 'https://a.espncdn.com/i/teamlogos/ncaa/500/218.png',
        'East Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
        'Tulsa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/202.png',
        'Nevada': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
        'UNLV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2439.png',
        'San Diego State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
        'Fresno State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
        'Hawaii': 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
        'Wyoming': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2751.png',
        'Utah State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
        'Colorado State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/36.png',
        'New Mexico': 'https://a.espncdn.com/i/teamlogos/ncaa/500/167.png',
        'Air Force': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'San Jose State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
        'Toledo': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2649.png',
        'Northern Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2459.png',
        'Central Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2117.png',
        'Western Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2711.png',
        'Eastern Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2199.png',
        'Ball State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2050.png',
        'Miami (OH)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/193.png',
        'Ohio': 'https://a.espncdn.com/i/teamlogos/ncaa/500/195.png',
        'Akron': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
        'Kent State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2309.png',
        'Buffalo': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2084.png',
        'Bowling Green': 'https://a.espncdn.com/i/teamlogos/ncaa/500/189.png',
        'Miami (OH)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/193.png',
        'Ohio': 'https://a.espncdn.com/i/teamlogos/ncaa/500/195.png',
        'Akron': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
        'Kent State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2309.png',
        'Buffalo': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2084.png',
        'Bowling Green': 'https://a.espncdn.com/i/teamlogos/ncaa/500/189.png',
        
        // Missing important FBS teams
        'Connecticut': 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png',
        'UMass': 'https://a.espncdn.com/i/teamlogos/ncaa/500/113.png',
        'New Mexico State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/166.png',
        'Sam Houston': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2383.png',
        'Jacksonville State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2290.png',
        'Kennesaw State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2302.png',
        'Delaware': 'https://a.espncdn.com/i/teamlogos/ncaa/500/45.png',
        'Tarleton State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2643.png',
        'Utah Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
        
        // Additional important FBS teams
        'USF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
        'South Florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
        
        // Common ESPN API variations that might not match exactly
        'Florida Atlantic': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2226.png',
        'Florida International': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2229.png',
        'FIU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2229.png',
        'FAU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2226.png',
        'Middle Tennessee State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2393.png',
        'MTSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2393.png',
        'Old Dominion': 'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
        'ODU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
        'James Madison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png',
        'JMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png',
        'Georgia State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png',
        'Georgia Southern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2240.png',
        'Temple': 'https://a.espncdn.com/i/teamlogos/ncaa/500/218.png',
        'East Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
        'ECU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
        'Tulsa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/202.png',
        'Nevada': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
        'UNLV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2439.png',
        'San Diego State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
        'SDSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
        'Fresno State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
        'Hawaii': 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
        'Wyoming': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2751.png',
        'Utah State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
        'Colorado State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/36.png',
        'CSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/36.png',
        'New Mexico': 'https://a.espncdn.com/i/teamlogos/ncaa/500/167.png',
        'San Jose State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
        'SJSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
        
        // Fix teams showing fallback logos - add ESPN API variations
        'Abilene Chrstn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'Abilene Christian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'Akron': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
        'UAB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/5.png',
        'Alabama-Birmingham': 'https://a.espncdn.com/i/teamlogos/ncaa/500/5.png',
        'Air Force': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'Southern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png',
        'Southern Miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png',
        'Fresno St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
        'Fresno State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
        'Texas St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/326.png',
        'Texas State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/326.png',
        'Arizona St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'Arizona State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'Portland St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/222.png',
        'Portland State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/222.png',
        'Hawai\'i': 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
        'Hawaii': 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
        
        // More ESPN API variations for teams showing fallback logos
        'W Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2711.png',
        'Western Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2711.png',
        'Arkansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
        'Ole Miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        'Jax State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2290.png',
        'Jacksonville State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2290.png',
        'GA Southern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2240.png',
        'Georgia Southern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2240.png',
        'Murray St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2399.png',
        'Murray State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2399.png',
        'Georgia St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png',
        'Georgia State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png',
        'App State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
        'Appalachian State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
        'Southern Miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png',
        'Prairie View': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2220.png',
        'Prairie View A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2220.png',
        'E Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2199.png',
        'Eastern Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2199.png',
        'UMass': 'https://a.espncdn.com/i/teamlogos/ncaa/500/113.png',
        'New Mexico St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/166.png',
        'New Mexico State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/166.png',
        'Louisiana Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2348.png',
        'East Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
        'ECU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
        'Coastal': 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png',
        'Coastal Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png',
        
        // All the teams still showing fallback logos from the screenshot
        'C Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2117.png',
        'Central Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2117.png',
        'Hou Christian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2264.png',
        'Houston Christian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2264.png',
        'Towson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2636.png',
        'Maryland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
        'William & Mary': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2765.png',
        'Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
        'Samford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2549.png',
        'Baylor': 'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png',
        'New Hampshire': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
        'Ball State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2050.png',
        'Villanova': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2785.png',
        'Penn State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        'Georgia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
        'Tennessee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
        'Oregon St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        'Oregon State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        'Texas Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
        'Norfolk St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2458.png',
        'Norfolk State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2458.png',
        'Rutgers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
        'Youngstown St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2786.png',
        'Youngstown State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2786.png',
        'Washington St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        'Washington State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        'North Texas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/249.png',
        'SMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png',
        'Missouri St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2438.png',
        'Missouri State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2438.png',
        'Pitt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
        'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
        'West Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png',
        'Richmond': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2508.png',
        'North Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
        'N\'Western St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2460.png',
        'Northwestern State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2460.png',
        'Cincinnati': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png',
        'Incarnate Word': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2271.png',
        'UTSA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2638.png',
        'Morgan St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2434.png',
        'Morgan State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2434.png',
        'Toledo': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2649.png',
        'Iowa State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
        'Arkansas St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2037.png',
        'Arkansas State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2037.png',
        'UTEP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2639.png',
        'Texas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        'South Florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
        'USF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
        'Miami': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        'Liberty': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2335.png',
        'Bowling Green': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2085.png',
        'MTSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2393.png',
        'Nevada': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
        'Alcorn St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'Alcorn State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'Mississippi St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
        'Mississippi State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
        'Merrimack': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2425.png',
        'Kennesaw St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
        'Kennesaw State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
        'E Kentucky': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2185.png',
        'Eastern Kentucky': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2185.png',
        'Marshall': 'https://a.espncdn.com/i/teamlogos/ncaa/500/276.png',
        'Monmouth': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2435.png',
        'Charlotte': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png',
        'USC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
        'Purdue': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
        'Ohio': 'https://a.espncdn.com/i/teamlogos/ncaa/500/195.png',
        'Ohio State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
        'Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
        'Old Dominion': 'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
        'Virginia Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
        'Florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
        'LSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
        'Texas A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        'Notre Dame': 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        'Rice': 'https://a.espncdn.com/i/teamlogos/ncaa/500/242.png',
        
        // Additional missing teams
        'UConn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png',
        'Connecticut': 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png',
        'Michigan St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
        'Michigan State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
        
        // New Hampshire with correct team ID
        'New Hampshire': 'https://a.espncdn.com/i/teamlogos/ncaa/500/160.png',
        'NH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/160.png',
        'UNH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/160.png',
        
        // Delaware with correct team ID
        'Delaware': 'https://a.espncdn.com/i/teamlogos/ncaa/500/48.png',
        'UD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/48.png',
        'UDel': 'https://a.espncdn.com/i/teamlogos/ncaa/500/48.png',
        
        // Villanova with correct team ID
        'Villanova': 'https://a.espncdn.com/i/teamlogos/ncaa/500/222.png',
        'Nova': 'https://a.espncdn.com/i/teamlogos/ncaa/500/222.png',
        'VU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/222.png',
        
        // Arkansas State with correct team ID
        'Arkansas State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        'Arkansas St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        'Ark St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        'A-State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        
        // Monmouth with correct team ID
        'Monmouth': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2405.png',
        'Monmouth Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2405.png',
        'MU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2405.png',
        
        // Portland State with correct team ID
        'Portland State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2502.png',
        'Portland St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2502.png',
        'Portland St.': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2502.png',
        'PSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2502.png',
        
        // Jacksonville State with correct team ID
        'Jacksonville State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png',
        'Jax State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png',
        'Jacksonville St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png',
        'Jacksonville St.': 'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png',
        'JSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png'
    };
    
    // Try exact match first
    console.log(`🔍 Trying exact match for: "${teamName}"`);
    console.log(`🔍 Team name length: ${teamName?.length}, type: ${typeof teamName}`);
    console.log(`🔍 First 10 available keys:`, Object.keys(collegeFootballLogos).slice(0, 10));
    
    if (collegeFootballLogos[teamName]) {
        console.log(`✅ Exact match found for "${teamName}": ${collegeFootballLogos[teamName]}`);
        return collegeFootballLogos[teamName];
    } else {
        console.log(`❌ No exact match for: "${teamName}"`);
        console.log(`🔍 Checking if similar keys exist:`);
        const similarKeys = Object.keys(collegeFootballLogos).filter(key => 
            key.toLowerCase().includes(teamName.toLowerCase()) || 
            teamName.toLowerCase().includes(key.toLowerCase())
        );
        console.log(`🔍 Similar keys found:`, similarKeys);
    }
    
    // Try flexible matching for common variations
    const teamVariations = {
        // Common abbreviations and variations
        'Ohio St': 'Ohio State',
        'Ohio St.': 'Ohio State',
        'Mich St': 'Michigan State',
        'Mich St.': 'Michigan State',
        'Penn St': 'Penn State',
        'Penn St.': 'Penn State',
        
        // ESPN API common variations (full team names with mascots)
        'Alabama Crimson Tide': 'Alabama',
        'Georgia Bulldogs': 'Georgia',
        'Ohio State Buckeyes': 'Ohio State',
        'Michigan Wolverines': 'Michigan',
        'LSU Tigers': 'LSU',
        'Florida Gators': 'Florida',
        'Auburn Tigers': 'Auburn',
        'Tennessee Volunteers': 'Tennessee',
        'Texas A&M Aggies': 'Texas A&M',
        'Oklahoma Sooners': 'Oklahoma',
        'Texas Longhorns': 'Texas',
        'USC Trojans': 'USC',
        'UCLA Bruins': 'UCLA',
        'Oregon Ducks': 'Oregon',
        'Washington Huskies': 'Washington',
        'Notre Dame Fighting Irish': 'Notre Dame',
        'Clemson Tigers': 'Clemson',
        'Florida State Seminoles': 'Florida State',
        'Miami Hurricanes': 'Miami',
        'Virginia Tech Hokies': 'Virginia Tech',
        'North Carolina Tar Heels': 'North Carolina',
        'Duke Blue Devils': 'Duke',
        'Wake Forest Demon Deacons': 'Wake Forest',
        'Boston College Eagles': 'Boston College',
        'Louisville Cardinals': 'Louisville',
        'Pittsburgh Panthers': 'Pittsburgh',
        'Syracuse Orange': 'Syracuse',
        'Virginia Cavaliers': 'Virginia',
        'Georgia Tech Yellow Jackets': 'Georgia Tech',
        
        'NC State': 'NC State',
        'N.C. State': 'NC State',
        'North Carolina State': 'NC State',
        'Florida St': 'Florida State',
        'Florida St.': 'Florida State',
        'FSU': 'Florida State',
        'Miami (FL)': 'Miami',
        'Miami FL': 'Miami',
        'Miami (Fla.)': 'Miami',
        'Virginia Tech': 'Virginia Tech',
        'Va Tech': 'Virginia Tech',
        'VT': 'Virginia Tech',
        'North Carolina': 'North Carolina',
        'UNC': 'North Carolina',
        'N.C.': 'North Carolina',
        'Duke': 'Duke',
        'Wake Forest': 'Wake Forest',
        'Boston College': 'Boston College',
        'BC': 'Boston College',
        'Louisville': 'Louisville',
        'Pittsburgh': 'Pittsburgh',
        'Pitt': 'Pittsburgh',
        'Syracuse': 'Syracuse',
        'Virginia': 'Virginia',
        'Georgia Tech': 'Georgia Tech',
        'GT': 'Georgia Tech',
        'Texas': 'Texas',
        'Oklahoma': 'Oklahoma',
        'OU': 'Oklahoma',
        'Oklahoma St': 'Oklahoma State',
        'Oklahoma St.': 'Oklahoma State',
        'Okla St': 'Oklahoma State',
        'Okla St.': 'Oklahoma State',
        'TCU': 'TCU',
        'Baylor': 'Baylor',
        'Kansas St': 'Kansas State',
        'Kansas St.': 'Kansas State',
        'K-State': 'Kansas State',
        'Iowa St': 'Iowa State',
        'Iowa St.': 'Iowa State',
        'Kansas': 'Kansas',
        'West Virginia': 'West Virginia',
        'WVU': 'West Virginia',
        'Texas Tech': 'Texas Tech',
        'Texas A&M': 'Texas A&M',
        'A&M': 'Texas A&M',
        'BYU': 'BYU',
        'Cincinnati': 'Cincinnati',
        'Houston': 'Houston',
        'UCF': 'UCF',
        'Central Florida': 'UCF',
        'USC': 'USC',
        'Southern Cal': 'USC',
        'UCLA': 'UCLA',
        'Oregon': 'Oregon',
        'Washington': 'Washington',
        'Stanford': 'Stanford',
        'California': 'California',
        'Cal': 'California',
        'Arizona': 'Arizona',
        'Arizona St': 'Arizona State',
        'Arizona St.': 'Arizona State',
        'Arizona State': 'Arizona State',
        'Utah': 'Utah',
        'Colorado': 'Colorado',
        'Oregon St': 'Oregon State',
        'Oregon St.': 'Oregon State',
        'Washington St': 'Washington State',
        'Washington St.': 'Washington State',
        'WSU': 'Washington State',
        'Notre Dame': 'Notre Dame',
        'Army': 'Army',
        'Navy': 'Navy',
        'Air Force': 'Air Force',
        'Boise St': 'Boise State',
        'Boise St.': 'Boise State',
        'Memphis': 'Memphis',
        'SMU': 'SMU',
        'Tulane': 'Tulane',
        'Liberty': 'Liberty',
        'App St': 'Appalachian State',
        'App St.': 'Appalachian State',
        'Appalachian St': 'Appalachian State',
        'Appalachian St.': 'Appalachian State',
        'Coastal Carolina': 'Coastal Carolina',
        'Marshall': 'Marshall',
        'Western Kentucky': 'Western Kentucky',
        'WKU': 'Western Kentucky',
        'Troy': 'Troy',
        'South Alabama': 'South Alabama',
        'Louisiana': 'Louisiana',
        'Louisiana-Lafayette': 'Louisiana',
        'UL Lafayette': 'Louisiana',
        'Louisiana Tech': 'Louisiana Tech',
        'La Tech': 'Louisiana Tech',
        'Southern Miss': 'Southern Miss',
        'Southern Mississippi': 'Southern Miss',
        'Arkansas St': 'Arkansas State',
        'Arkansas St.': 'Arkansas State',
        'Texas St': 'Texas State',
        'Texas St.': 'Texas State',
        'UTSA': 'UTSA',
        'North Texas': 'North Texas',
        'Rice': 'Rice',
        'Charlotte': 'Charlotte',
        'Florida Atlantic': 'Florida Atlantic',
        'FAU': 'Florida Atlantic',
        'FIU': 'FIU',
        'Florida International': 'FIU',
        'Middle Tennessee': 'Middle Tennessee',
        'MTSU': 'Middle Tennessee',
        'Old Dominion': 'Old Dominion',
        'ODU': 'Old Dominion',
        'James Madison': 'James Madison',
        'JMU': 'James Madison',
        'Georgia State': 'Georgia State',
        'Georgia Southern': 'Georgia Southern',
        'Temple': 'Temple',
        'East Carolina': 'East Carolina',
        'ECU': 'East Carolina',
        'Tulsa': 'Tulsa',
        'Nevada': 'Nevada',
        'UNLV': 'UNLV',
        'San Diego St': 'San Diego State',
        'San Diego St.': 'San Diego State',
        'Fresno St': 'Fresno State',
        'Fresno St.': 'Fresno State',
        'Hawaii': 'Hawaii',
        'Wyoming': 'Wyoming',
        'Utah St': 'Utah State',
        'Utah St.': 'Utah State',
        'Colorado St': 'Colorado State',
        'Colorado St.': 'Colorado State',
        'New Mexico': 'New Mexico',
        'San Jose St': 'San Jose State',
        'San Jose St.': 'San Jose State',
        'Toledo': 'Toledo',
        'Northern Illinois': 'Northern Illinois',
        'NIU': 'Northern Illinois',
        'Central Michigan': 'Central Michigan',
        'CMU': 'Central Michigan',
        'Western Michigan': 'Western Michigan',
        'WMU': 'Western Michigan',
        'Eastern Michigan': 'Eastern Michigan',
        'EMU': 'Eastern Michigan',
        'Ball State': 'Ball State',
        'Miami (OH)': 'Miami (OH)',
        'Miami OH': 'Miami (OH)',
        'Ohio': 'Ohio',
        'Akron': 'Akron',
        'Kent St': 'Kent State',
        'Kent St.': 'Kent State',
        'Buffalo': 'Buffalo',
        'Bowling Green': 'Bowling Green',
        'BGSU': 'Bowling Green'
    };
    
    console.log(`🔍 Available logo keys (first 10):`, Object.keys(collegeFootballLogos).slice(0, 10));
    
    // DEBUG: Show the exact team name being searched
    console.log(`🔍 EXACT TEAM NAME: "${teamName}"`);
    console.log(`🔍 Team name length: ${teamName?.length}`);
    console.log(`🔍 Team name char codes:`, teamName.split('').map(c => c.charCodeAt(0)));
    
    // Try exact match first
    if (collegeFootballLogos[teamName]) {
        console.log(`✅ Exact match found for "${teamName}"`);
        return collegeFootballLogos[teamName];
    }
    
    // Try case-insensitive exact match
    const teamNameLower = teamName.toLowerCase();
    for (const [key, logoUrl] of Object.entries(collegeFootballLogos)) {
        if (key.toLowerCase() === teamNameLower) {
            console.log(`✅ Case-insensitive exact match found: "${teamName}" -> "${key}"`);
                return logoUrl;
        }
    }
    
    // Try partial matching for common variations
    for (const [key, logoUrl] of Object.entries(collegeFootballLogos)) {
        const keyLower = key.toLowerCase();
        const teamLower = teamName.toLowerCase();
        
        // Check if team name contains the key or vice versa
        if (teamLower.includes(keyLower) || keyLower.includes(teamLower)) {
            console.log(`✅ Partial match found: "${teamName}" -> "${key}"`);
            return logoUrl;
        }
        
        // Check for common abbreviations
        if (keyLower.includes('state') && teamLower.includes('st')) {
            const baseKey = keyLower.replace(' state', '').replace(' st', '');
            const baseTeam = teamLower.replace(' st', '');
            if (baseKey === baseTeam) {
                console.log(`✅ State abbreviation match found: "${teamName}" -> "${key}"`);
                return logoUrl;
            }
        }
    }
    
    console.log(`❌ NO MATCH FOUND for: "${teamName}"`);
    return null;
}

// Clean college football team names to show just the school name
function cleanCollegeFootballTeamName(teamName) {
    const teamNameMappings = {
        // SEC
        'Alabama Crimson Tide': 'Alabama',
        'Auburn Tigers': 'Auburn',
        'Florida Gators': 'Florida',
        'Georgia Bulldogs': 'Georgia',
        'Kentucky Wildcats': 'Kentucky',
        'LSU Tigers': 'LSU',
        'Mississippi State Bulldogs': 'Mississippi State',
        'Missouri Tigers': 'Missouri',
        'Ole Miss Rebels': 'Ole Miss',
        'South Carolina Gamecocks': 'South Carolina',
        'Tennessee Volunteers': 'Tennessee',
        'Texas A&M Aggies': 'Texas A&M',
        'Vanderbilt Commodores': 'Vanderbilt',
        'Arkansas Razorbacks': 'Arkansas',
        
        // Big Ten
        'Ohio State Buckeyes': 'Ohio State',
        'Michigan Wolverines': 'Michigan',
        'Penn State Nittany Lions': 'Penn State',
        'Wisconsin Badgers': 'Wisconsin',
        'Iowa Hawkeyes': 'Iowa',
        'Michigan State Spartans': 'Michigan State',
        'Nebraska Cornhuskers': 'Nebraska',
        'Minnesota Golden Gophers': 'Minnesota',
        'Northwestern Wildcats': 'Northwestern',
        'Purdue Boilermakers': 'Purdue',
        'Indiana Hoosiers': 'Indiana',
        'Illinois Fighting Illini': 'Illinois',
        'Maryland Terrapins': 'Maryland',
        'Rutgers Scarlet Knights': 'Rutgers',
        
        // ACC
        'Clemson Tigers': 'Clemson',
        'Florida State Seminoles': 'Florida State',
        'Miami Hurricanes': 'Miami',
        'Virginia Tech Hokies': 'Virginia Tech',
        'North Carolina Tar Heels': 'North Carolina',
        'NC State Wolfpack': 'NC State',
        'Duke Blue Devils': 'Duke',
        'Wake Forest Demon Deacons': 'Wake Forest',
        'Boston College Eagles': 'Boston College',
        'Louisville Cardinals': 'Louisville',
        'Pittsburgh Panthers': 'Pittsburgh',
        'Syracuse Orange': 'Syracuse',
        'Virginia Cavaliers': 'Virginia',
        'Georgia Tech Yellow Jackets': 'Georgia Tech',
        
        // Big 12
        'Texas Longhorns': 'Texas',
        'Oklahoma Sooners': 'Oklahoma',
        'Oklahoma State Cowboys': 'Oklahoma State',
        'TCU Horned Frogs': 'TCU',
        'Baylor Bears': 'Baylor',
        'Kansas State Wildcats': 'Kansas State',
        'Iowa State Cyclones': 'Iowa State',
        'Kansas Jayhawks': 'Kansas',
        'West Virginia Mountaineers': 'West Virginia',
        'Texas Tech Red Raiders': 'Texas Tech',
        'BYU Cougars': 'BYU',
        'Cincinnati Bearcats': 'Cincinnati',
        'Houston Cougars': 'Houston',
        'UCF Knights': 'UCF',
        
        // Pac-12
        'USC Trojans': 'USC',
        'UCLA Bruins': 'UCLA',
        'Oregon Ducks': 'Oregon',
        'Washington Huskies': 'Washington',
        'Stanford Cardinal': 'Stanford',
        'California Golden Bears': 'California',
        'Arizona Wildcats': 'Arizona',
        'Arizona State Sun Devils': 'Arizona State',
        'Utah Utes': 'Utah',
        'Colorado Buffaloes': 'Colorado',
        'Oregon State Beavers': 'Oregon State',
        'Washington State Cougars': 'Washington State',
        
        // Other Notable Programs
        'Notre Dame Fighting Irish': 'Notre Dame',
        'Army Black Knights': 'Army',
        'Navy Midshipmen': 'Navy',
        'Air Force Falcons': 'Air Force',
        'Boise State Broncos': 'Boise State',
        'Memphis Tigers': 'Memphis',
        'SMU Mustangs': 'SMU',
        'Tulane Green Wave': 'Tulane',
        'Liberty Flames': 'Liberty',
        'Appalachian State Mountaineers': 'Appalachian State',
        'Coastal Carolina Chanticleers': 'Coastal Carolina',
        'Marshall Thundering Herd': 'Marshall',
        'Western Kentucky Hilltoppers': 'Western Kentucky',
        'Troy Trojans': 'Troy',
        'South Alabama Jaguars': 'South Alabama',
        'Louisiana Ragin\' Cajuns': 'Louisiana',
        'Louisiana Tech Bulldogs': 'Louisiana Tech',
        'Southern Miss Golden Eagles': 'Southern Miss',
        'Arkansas State Red Wolves': 'Arkansas State',
        'Texas State Bobcats': 'Texas State',
        'UTSA Roadrunners': 'UTSA',
        'North Texas Mean Green': 'North Texas',
        'Rice Owls': 'Rice',
        'Charlotte 49ers': 'Charlotte',
        'Florida Atlantic Owls': 'Florida Atlantic',
        'FIU Panthers': 'FIU',
        'Middle Tennessee Blue Raiders': 'Middle Tennessee',
        'Old Dominion Monarchs': 'Old Dominion',
        'James Madison Dukes': 'James Madison',
        'Georgia State Panthers': 'Georgia State',
        'Georgia Southern Eagles': 'Georgia Southern',
        'Temple Owls': 'Temple',
        'East Carolina Pirates': 'East Carolina',
        'Tulsa Golden Hurricane': 'Tulsa',
        'Nevada Wolf Pack': 'Nevada',
        'UNLV Rebels': 'UNLV',
        'San Diego State Aztecs': 'San Diego State',
        'Fresno State Bulldogs': 'Fresno State',
        'Hawaii Rainbow Warriors': 'Hawaii',
        'Wyoming Cowboys': 'Wyoming',
        'Utah State Aggies': 'Utah State',
        'Colorado State Rams': 'Colorado State',
        'New Mexico Lobos': 'New Mexico',
        'San Jose State Spartans': 'San Jose State',
        'Toledo Rockets': 'Toledo',
        'Northern Illinois Huskies': 'Northern Illinois',
        'Central Michigan Chippewas': 'Central Michigan',
        'Western Michigan Broncos': 'Western Michigan',
        'Eastern Michigan Eagles': 'Eastern Michigan',
        'Ball State Cardinals': 'Ball State',
        'Miami (OH) RedHawks': 'Miami (OH)',
        'Ohio Bobcats': 'Ohio',
        'Akron Zips': 'Akron',
        'Kent State Golden Flashes': 'Kent State',
        'Buffalo Bulls': 'Buffalo',
        'Bowling Green Falcons': 'Bowling Green',
        
        // Additional teams that might be missing
        'UAB Blazers': 'UAB',
        'UTEP Miners': 'UTEP',
        'New Mexico State Aggies': 'New Mexico State',
        'Massachusetts Minutemen': 'Massachusetts',
        'Connecticut Huskies': 'Connecticut',
        'UMass Minutemen': 'Massachusetts',
        'Coastal Carolina Chanticleers': 'Coastal Carolina',
        'App State Mountaineers': 'Appalachian State',
        'Georgia Southern Eagles': 'Georgia Southern',
        'Troy Trojans': 'Troy',
        'South Alabama Jaguars': 'South Alabama',
        'Louisiana Ragin\' Cajuns': 'Louisiana',
        'Louisiana Tech Bulldogs': 'Louisiana Tech',
        'Southern Miss Golden Eagles': 'Southern Miss',
        'Arkansas State Red Wolves': 'Arkansas State',
        'Texas State Bobcats': 'Texas State',
        'UTSA Roadrunners': 'UTSA',
        'North Texas Mean Green': 'North Texas',
        'Rice Owls': 'Rice',
        'Charlotte 49ers': 'Charlotte',
        'Florida Atlantic Owls': 'Florida Atlantic',
        'FIU Panthers': 'FIU',
        'Middle Tennessee Blue Raiders': 'Middle Tennessee',
        'Old Dominion Monarchs': 'Old Dominion',
        'James Madison Dukes': 'James Madison',
        'Georgia State Panthers': 'Georgia State',
        'Temple Owls': 'Temple',
        'East Carolina Pirates': 'East Carolina',
        'Tulsa Golden Hurricane': 'Tulsa',
        'Nevada Wolf Pack': 'Nevada',
        'UNLV Rebels': 'UNLV',
        'San Diego State Aztecs': 'San Diego State',
        'Fresno State Bulldogs': 'Fresno State',
        'Hawaii Rainbow Warriors': 'Hawaii',
        'Wyoming Cowboys': 'Wyoming',
        'Utah State Aggies': 'Utah State',
        'Colorado State Rams': 'Colorado State',
        'New Mexico Lobos': 'New Mexico',
        'San Jose State Spartans': 'San Jose State',
        'Toledo Rockets': 'Toledo',
        'Northern Illinois Huskies': 'Northern Illinois',
        'Central Michigan Chippewas': 'Central Michigan',
        'Western Michigan Broncos': 'Western Michigan',
        'Eastern Michigan Eagles': 'Eastern Michigan',
        'Ball State Cardinals': 'Ball State',
        'Miami (OH) RedHawks': 'Miami (OH)',
        'Ohio Bobcats': 'Ohio',
        'Akron Zips': 'Akron',
        'Kent State Golden Flashes': 'Kent State',
        'Buffalo Bulls': 'Buffalo',
        'Bowling Green Falcons': 'Bowling Green',
        
        // Additional common teams
        'UAB Blazers': 'UAB',
        'UTEP Miners': 'UTEP',
        'New Mexico State Aggies': 'New Mexico State',
        'Massachusetts Minutemen': 'Massachusetts',
        'Connecticut Huskies': 'Connecticut',
        'UMass Minutemen': 'Massachusetts',
        'Coastal Carolina Chanticleers': 'Coastal Carolina',
        'App State Mountaineers': 'Appalachian State',
        'Georgia Southern Eagles': 'Georgia Southern',
        'Troy Trojans': 'Troy',
        'South Alabama Jaguars': 'South Alabama',
        'Louisiana Ragin\' Cajuns': 'Louisiana',
        'Louisiana Tech Bulldogs': 'Louisiana Tech',
        'Southern Miss Golden Eagles': 'Southern Miss',
        'Arkansas State Red Wolves': 'Arkansas State',
        'Texas State Bobcats': 'Texas State',
        'UTSA Roadrunners': 'UTSA',
        'North Texas Mean Green': 'North Texas',
        'Rice Owls': 'Rice',
        'Charlotte 49ers': 'Charlotte',
        'Florida Atlantic Owls': 'Florida Atlantic',
        'FIU Panthers': 'FIU',
        'Middle Tennessee Blue Raiders': 'Middle Tennessee',
        'Old Dominion Monarchs': 'Old Dominion',
        'James Madison Dukes': 'James Madison',
        'Georgia State Panthers': 'Georgia State',
        'Temple Owls': 'Temple',
        'East Carolina Pirates': 'East Carolina',
        'Tulsa Golden Hurricane': 'Tulsa',
        'Nevada Wolf Pack': 'Nevada',
        'UNLV Rebels': 'UNLV',
        'San Diego State Aztecs': 'San Diego State',
        'Fresno State Bulldogs': 'Fresno State',
        'Hawaii Rainbow Warriors': 'Hawaii',
        'Wyoming Cowboys': 'Wyoming',
        'Utah State Aggies': 'Utah State',
        'Colorado State Rams': 'Colorado State',
        'New Mexico Lobos': 'New Mexico',
        'San Jose State Spartans': 'San Jose State',
        'Toledo Rockets': 'Toledo',
        'Northern Illinois Huskies': 'Northern Illinois',
        'Central Michigan Chippewas': 'Central Michigan',
        'Western Michigan Broncos': 'Western Michigan',
        'Eastern Michigan Eagles': 'Eastern Michigan',
        'Ball State Cardinals': 'Ball State',
        'Miami (OH) RedHawks': 'Miami (OH)',
        'Ohio Bobcats': 'Ohio',
        'Akron Zips': 'Akron',
        'Kent State Golden Flashes': 'Kent State',
        'Buffalo Bulls': 'Buffalo',
        'Bowling Green Falcons': 'Bowling Green'
    };
    
    // Try exact match first
    if (teamNameMappings[teamName]) {
        return teamNameMappings[teamName];
    }
    
    // Try specific mascot mappings (only for unique mascots that don't conflict)
    const uniqueMascotMappings = {
        'Crimson Tide': 'Alabama',
        'Gators': 'Florida',
        'Volunteers': 'Tennessee',
        'Commodores': 'Vanderbilt',
        'Razorbacks': 'Arkansas',
        'Buckeyes': 'Ohio State',
        'Wolverines': 'Michigan',
        'Nittany Lions': 'Penn State',
        'Badgers': 'Wisconsin',
        'Hawkeyes': 'Iowa',
        'Cornhuskers': 'Nebraska',
        'Golden Gophers': 'Minnesota',
        'Boilermakers': 'Purdue',
        'Hoosiers': 'Indiana',
        'Fighting Illini': 'Illinois',
        'Terrapins': 'Maryland',
        'Scarlet Knights': 'Rutgers',
        'Seminoles': 'Florida State',
        'Hurricanes': 'Miami',
        'Hokies': 'Virginia Tech',
        'Tar Heels': 'North Carolina',
        'Wolfpack': 'NC State',
        'Blue Devils': 'Duke',
        'Demon Deacons': 'Wake Forest',
        'Yellow Jackets': 'Georgia Tech',
        'Longhorns': 'Texas',
        'Sooners': 'Oklahoma',
        'Horned Frogs': 'TCU',
        'Cyclones': 'Iowa State',
        'Jayhawks': 'Kansas',
        'Red Raiders': 'Texas Tech',
        'Trojans': 'USC',
        'Bruins': 'UCLA',
        'Ducks': 'Oregon',
        'Cardinal': 'Stanford',
        'Golden Bears': 'California',
        'Sun Devils': 'Arizona State',
        'Utes': 'Utah',
        'Buffaloes': 'Colorado',
        'Beavers': 'Oregon State',
        'Fighting Irish': 'Notre Dame',
        'Black Knights': 'Army',
        'Midshipmen': 'Navy',
        'Mustangs': 'SMU',
        'Green Wave': 'Tulane',
        'Flames': 'Liberty',
        'Chanticleers': 'Coastal Carolina',
        'Thundering Herd': 'Marshall',
        'Hilltoppers': 'Western Kentucky',
        'Jaguars': 'South Alabama',
        'Ragin\' Cajuns': 'Louisiana',
        'Golden Eagles': 'Southern Miss',
        'Red Wolves': 'Arkansas State',
        'Roadrunners': 'UTSA',
        'Mean Green': 'North Texas',
        '49ers': 'Charlotte',
        'Blue Raiders': 'Middle Tennessee',
        'Monarchs': 'Old Dominion',
        'Dukes': 'James Madison',
        'Pirates': 'East Carolina',
        'Golden Hurricane': 'Tulsa',
        'Wolf Pack': 'Nevada',
        'Rebels': 'UNLV',
        'Aztecs': 'San Diego State',
        'Rainbow Warriors': 'Hawaii',
        'Lobos': 'New Mexico',
        'Rockets': 'Toledo',
        'Chippewas': 'Central Michigan',
        'RedHawks': 'Miami (OH)',
        'Zips': 'Akron',
        'Golden Flashes': 'Kent State',
        'Bulls': 'Buffalo'
    };
    
    // Try unique mascot mapping (only for mascots that are unique to one team)
    if (uniqueMascotMappings[teamName]) {
        console.log(`🎭 Unique mascot mapping found: "${teamName}" -> "${uniqueMascotMappings[teamName]}"`);
        return uniqueMascotMappings[teamName];
    }
    
    // If no exact match, return the original name
    console.log(`❌ No mapping found for: "${teamName}"`);
    return teamName;
}

// Get team highlight class for possession/at-bat highlighting
function getTeamHighlightClass(game, teamSide) {
    if (game.status !== 'live') return '';
    
    if (game.sport === 'nfl' || game.sport === 'college-football') {
        // For football, highlight team with possession
        console.log(`=== FOOTBALL HIGHLIGHT DEBUG ===`);
        console.log('Game:', game.awayTeam, 'vs', game.homeTeam);
        console.log('Team side:', teamSide);
        console.log('Possession team ID:', game.possessionTeam);
        console.log('Away team ID:', game.awayTeamId);
        console.log('Home team ID:', game.homeTeamId);

        if (game.possessionTeam && (game.awayTeamId || game.homeTeamId)) {
            // Compare possession team ID with team IDs
            const teamId = teamSide === 'away' ? game.awayTeamId : game.homeTeamId;
            const hasPossession = game.possessionTeam === teamId;

            console.log(`Checking possession: "${game.possessionTeam}" vs "${teamId}" = ${hasPossession}`);

            if (hasPossession) {
                console.log(`Returning 'possession' class for ${teamSide} team`);
                return 'possession';
            }
        } else {
            console.log('No possession team data or team IDs available');
        }
        console.log(`=== END FOOTBALL HIGHLIGHT DEBUG ===`);
    } else if (game.sport === 'mlb') {
        // For baseball, highlight team at bat
        if (game.atBatTeam === teamSide) {
            return 'at-bat';
        }
    }
    
    return '';
}

// Get game time display with quarter/period info for live games
function getGameTimeDisplay(game) {
    // Debug logging for live games to see data structure
    if (game.status === 'live') {
        console.log(`Live game data for ${game.awayTeam} vs ${game.homeTeam}:`, {
            sport: game.sport,
            period: game.period,
            clock: game.clock,
            time: game.time,
            displayTime: game.displayTime,
            fullGame: game
        });
    }
    
    if (game.status === 'live') {
        let periodInfo = '';
        
        // Add quarter/period information based on sport
        if (game.sport === 'nfl' || game.sport === 'ncaaf') {
            periodInfo = `Q${game.period || '1'}`;
        } else if (game.sport === 'nba' || game.sport === 'ncaab') {
            periodInfo = `Q${game.period || '1'}`;
        } else if (game.sport === 'mlb') {
            // MLB: Show inning with top/bottom indicator
            if (game.inningNumber && game.inningNumber > 0) {
                const inningText = game.inningNumber === 1 ? '1st' : 
                                  game.inningNumber === 2 ? '2nd' : 
                                  game.inningNumber === 3 ? '3rd' : 
                                  `${game.inningNumber}th`;
                
                let inningState = '';
                if (game.topBottom === 'top') inningState = 'top';
                else if (game.topBottom === 'bot') inningState = 'bot';
                else if (game.topBottom === 'mid') inningState = 'mid';
                else if (game.topBottom === 'end') inningState = 'end';
                
                periodInfo = `${inningState} ${inningText}`;
            } else if (game.period && game.period > 0) {
                // Fallback to period if inningNumber not available
                const inningText = game.period === 1 ? '1st' : 
                                  game.period === 2 ? '2nd' : 
                                  game.period === 3 ? '3rd' : 
                                  `${game.period}th`;
                
                let inningState = '';
                if (game.topBottom === 'top') inningState = 'top';
                else if (game.topBottom === 'bot') inningState = 'bot';
                else if (game.topBottom === 'mid') inningState = 'mid';
                else if (game.topBottom === 'end') inningState = 'end';
                
                periodInfo = `${inningState} ${inningText}`;
            } else {
                periodInfo = 'top 1st';
            }
            
            // Count dots will be displayed next to bases (outside the bubble)
            
            // Store bases info separately (will be displayed outside the bubble)
            if (game.bases) {
                console.log(`Bases info available: ${game.bases}`);
            }
            
            console.log(`Final periodInfo: "${periodInfo}"`);
        } else if (game.sport === 'nhl') {
            periodInfo = `P${game.period || '1'}`;
        } else if (game.sport === 'soccer') {
            periodInfo = `${game.period || '1'}H`;
        }
        
        // Convert clock to readable time format
        let clockInfo = '';
        if (game.clock && game.clock !== '0:00' && game.clock !== '' && game.clock !== '697') {
            // Convert raw clock data to readable format
            const readableClock = convertClockToReadable(game.clock, game.sport);
            if (readableClock) {
                clockInfo = ` ${readableClock}`;
            }
        }
        
        // Return period + clock/time info, or just period if no valid time
        if (clockInfo && clockInfo.trim() !== '') {
            return `${periodInfo}${clockInfo}`;
        } else {
            return `${periodInfo}`;
        }
    }
    
    // For non-live games, return the regular time
    return game.displayTime || game.time || 'TBD';
}

// Convert raw clock data to readable time format
function convertClockToReadable(clock, sport) {
    console.log(`Converting clock: ${clock} for sport: ${sport}`);
    
    // If it's already in readable format (e.g., "8:45"), return as is
    if (typeof clock === 'string' && clock.includes(':')) {
        return clock;
    }
    
    // Convert raw numbers to readable time
    if (typeof clock === 'number' || !isNaN(parseInt(clock))) {
        const clockNum = parseInt(clock);
        
        if (sport === 'soccer') {
            // Soccer: convert seconds to MM:SS format
            const minutes = Math.floor(clockNum / 60);
            const seconds = clockNum % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else if (sport === 'nfl' || sport === 'ncaaf' || sport === 'nba' || sport === 'ncaab') {
            // Football/Basketball: convert seconds to MM:SS format
            const minutes = Math.floor(clockNum / 60);
            const seconds = clockNum % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else if (sport === 'mlb') {
            // Baseball: might be outs or inning info
            return `${clockNum} outs`;
        } else if (sport === 'nhl') {
            // Hockey: convert seconds to MM:SS format
            const minutes = Math.floor(clockNum / 60);
            const seconds = clockNum % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // If we can't convert it, return null
    console.log(`Could not convert clock: ${clock}`);
    return null;
}

// Get visual representation of bases as HTML
function getBasesVisual(bases) {
    if (!bases) return '';
    
    // Create a baseball diamond layout (first base on right, third on left)
    let html = '<div class="bases-diamond">';
    
    // Second base (top)
    const secondBase = (bases === '2nd' || bases === '1st & 2nd' || bases === '2nd & 3rd' || bases === 'loaded') ? 'occupied' : 'empty';
    html += `<div class="base second-base ${secondBase}"></div>`;
    
    // Third base (left) and first base (right)
    html += '<div class="bases-row">';
    const firstBase = (bases === '1st' || bases === '1st & 2nd' || bases === '1st & 3rd' || bases === 'loaded') ? 'occupied' : 'empty';
    const thirdBase = (bases === '3rd' || bases === '1st & 3rd' || bases === '2nd & 3rd' || bases === 'loaded') ? 'occupied' : 'empty';
    
    html += `<div class="base third-base ${thirdBase}"></div>`;
    html += `<div class="base first-base ${firstBase}"></div>`;
    html += '</div>';
    
    html += '</div>';
    
    return html;
}

// Get visual representation of count dots (balls, strikes, outs)
function getCountDotsVisual(game) {
    if (game.sport !== 'mlb') return '';
    
    let html = '<div class="count-dots-container">';
    
    // Add balls dots (3 dots horizontal)
    if (game.balls !== null && game.balls !== undefined) {
        html += '<div class="count-dots balls-dots">';
        html += '<span class="count-label">B</span>';
        for (let i = 0; i < 3; i++) {
            html += `<span class="count-dot ${i < game.balls ? 'active' : ''}">●</span>`;
        }
        html += '</div>';
    }
    
    // Add strikes dots (2 dots horizontal)
    if (game.strikes !== null && game.strikes !== undefined) {
        html += '<div class="count-dots strikes-dots">';
        html += '<span class="count-label">S</span>';
        for (let i = 0; i < 2; i++) {
            html += `<span class="count-dot ${i < game.balls ? 'active' : ''}">●</span>`;
        }
        html += '</div>';
    }
    
    // Add outs dots (2 dots horizontal)
    if (game.outs !== null && game.outs !== undefined) {
        html += '<div class="count-dots outs-dots">';
        html += '<span class="count-label">O</span>';
        for (let i = 0; i < 2; i++) {
            html += `<span class="count-dot ${i < game.outs ? 'active' : ''}">●</span>`;
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

// Test function for MLB inning display (can be called from console)
function testMLBInningDisplay() {
    console.log('=== TESTING MLB INNING DISPLAY ===');
    
    // Find all MLB games
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    console.log(`Found ${mlbGames.length} MLB games`);
    
    mlbGames.forEach((game, index) => {
        console.log(`\nMLB Game ${index + 1}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log('Status:', game.status);
        console.log('Period:', game.period);
        console.log('Inning Number:', game.inningNumber);
        console.log('Top/Bottom:', game.topBottom);
        console.log('Bases:', game.bases);
        console.log('Outs:', game.outs);
        console.log('Time:', game.time);
        console.log('Display Time:', game.displayTime);
        
        // Test the inning display
        const inningDisplay = getGameTimeDisplay(game);
        console.log('Final Inning Display:', inningDisplay);
    });
    
    console.log('=== END TESTING ===');
}

// Debug function to see what ESPN is actually sending for inning data
function debugMLBInningData() {
    console.log('=== DEBUGGING MLB INNING DATA ===');
    
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    mlbGames.forEach((game, index) => {
        console.log(`\nGame ${index + 1}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log('Current inning state:', {
            inningNumber: game.inningNumber,
            topBottom: game.topBottom,
            outs: game.outs,
            bases: game.bases
        });
        
        // Check if we have stored inning state
        if (window.lastInningState) {
            console.log('Stored inning state:', window.lastInningState);
        } else {
            console.log('No stored inning state');
        }
        
        // Show what the pattern says vs what we have
        if (game.inningNumber) {
            let expectedTopBottom;
            if (game.inningNumber === 1) {
                expectedTopBottom = 'top';
            } else if (game.inningNumber % 2 === 0) {
                expectedTopBottom = 'bot';
            } else {
                expectedTopBottom = 'top';
            }
            
            if (game.topBottom !== expectedTopBottom) {
                console.log(`❌ MISMATCH: Has ${game.topBottom}, should be ${expectedTopBottom}`);
            } else {
                console.log(`✅ MATCH: ${game.topBottom} is correct`);
            }
        }
    });
    
    console.log('=== END DEBUGGING ===');
}

// Function to manually force inning progression for testing
function forceInningProgression() {
    console.log('=== FORCING INNING PROGRESSION ===');
    
    if (!window.lastInningState) {
        console.log('No stored inning state, creating initial state');
        window.lastInningState = { inning: 1, topBottom: 'top' };
    }
    
    const current = window.lastInningState;
    console.log('Current stored state:', current);
    
    // Force progression to next state
    if (current.topBottom === 'top') {
        // Top of inning ended, next should be bottom of same inning
        window.lastInningState = { inning: current.inning, topBottom: 'bot' };
        console.log('Forced progression: top -> bottom of inning', current.inning);
    } else if (current.topBottom === 'bot') {
        // Bottom of inning ended, next should be top of next inning
        window.lastInningState = { inning: current.inning + 1, topBottom: 'top' };
        console.log('Forced progression: bottom -> top of inning', current.inning + 1);
    }
    
    console.log('New stored state:', window.lastInningState);
    console.log('=== END FORCING ===');
}

// Function to manually override inning state for a specific game
function overrideInningState(gameIndex, newInning, newTopBottom) {
    console.log(`=== OVERRIDING INNING STATE ===`);
    
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    if (gameIndex >= 0 && gameIndex < mlbGames.length) {
        const game = mlbGames[gameIndex];
        console.log(`Game ${gameIndex}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log(`Old state: inning ${game.inningNumber}, ${game.topBottom}`);
        
        // Override the game's inning state
        game.inningNumber = newInning;
        game.topBottom = newTopBottom;
        
        console.log(`New state: inning ${game.inningNumber}, ${game.topBottom}`);
        console.log('Refreshing display...');
        
        // Refresh the display to show the change
        displayScores();
    } else {
        console.log(`Invalid game index: ${gameIndex}. Available games: ${mlbGames.length}`);
    }
    
    console.log('=== END OVERRIDING ===');
}

// Function to show outs-based inning calculation for debugging
function showOutsBasedCalculation() {
    console.log('=== OUTS-BASED INNING CALCULATION ===');
    
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    mlbGames.forEach((game, index) => {
        console.log(`\nGame ${index}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log(`ESPN data: inning ${game.inningNumber}, ${game.topBottom}, ${game.outs} outs`);
        
        if (game.outs !== null && game.outs !== undefined) {
            // Calculate what it should be based on outs
            let calculatedInning, calculatedTopBottom;
            
            // Calculate total half-innings completed (each half-inning = 3 outs)
            const halfInningsCompleted = Math.floor(game.outs / 3);
            
            // Calculate which inning we're in (every 2 half-innings = 1 full inning)
            calculatedInning = Math.floor(halfInningsCompleted / 2) + 1;
            
            // Calculate which half of the inning (even = top, odd = bottom)
            calculatedTopBottom = halfInningsCompleted % 2 === 0 ? 'top' : 'bot';
            
            console.log(`Outs calculation: inning ${calculatedInning}, ${calculatedTopBottom} (${game.outs} outs)`);
            
            if (calculatedInning !== game.inningNumber || calculatedTopBottom !== game.topBottom) {
                console.log(`❌ MISMATCH: ESPN vs Outs calculation`);
            } else {
                console.log(`✅ MATCH: ESPN data matches outs calculation`);
            }
        } else {
            console.log('No outs data available');
        }
    });
    
    console.log('=== END OUTS-BASED CALCULATION ===');
}

// Test function to verify the outs calculation logic
function testOutsCalculation() {
    console.log('=== TESTING OUTS CALCULATION LOGIC ===');
    
    const testCases = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    
    testCases.forEach(outs => {
        const halfInningsCompleted = Math.floor(outs / 3);
        const calculatedInning = Math.floor(halfInningsCompleted / 2) + 1;
        const calculatedTopBottom = halfInningsCompleted % 2 === 0 ? 'top' : 'bot';
        
        console.log(`${outs} outs = ${halfInningsCompleted} half-innings = inning ${calculatedInning} ${calculatedTopBottom}`);
    });
    
    console.log('=== END TESTING ===');
}

// Function to inspect raw ESPN data for outs field
function inspectESPNOutsData() {
    console.log('=== INSPECTING ESPN OUTS DATA ===');
    
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    mlbGames.forEach((game, index) => {
        console.log(`\nGame ${index}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log(`Parsed data: inning ${game.inningNumber}, topBottom: ${game.topBottom}, outs: ${game.outs}`);
        console.log(`Outs type: ${typeof game.outs}, value: ${game.outs}`);
        
        // Check if we can find the original ESPN data
        if (window.rawESPNData && window.rawESPNData.events) {
            const espnEvent = window.rawESPNData.events.find(event => 
                event.name && event.name.includes(game.awayTeam) && event.name.includes(game.name)
            );
            
            if (espnEvent) {
                console.log('Found ESPN event, checking competition.situation:');
                const competition = espnEvent.competitions?.[0];
                if (competition?.situation) {
                    console.log('Raw situation object:', competition.situation);
                    console.log('situation.outs:', competition.situation.outs);
                    console.log('situation.inning:', competition.situation.inning);
                    console.log('situation.topOfInning:', competition.situation.topOfInning);
                } else {
                    console.log('No competition.situation found');
                }
            } else {
                console.log('Could not find matching ESPN event');
            }
        } else {
            console.log('No raw ESPN data available');
        }
    });
    
    console.log('=== END INSPECTING ===');
}

// Function to debug the new hybrid inning tracking approach
function debugHybridInningTracking() {
    console.log('=== HYBRID INNING TRACKING DEBUG ===');
    
    if (!window.inningTracker) {
        console.log('No inning tracker initialized yet');
        return;
    }
    
    Object.keys(window.inningTracker).forEach(gameKey => {
        const tracker = window.inningTracker[gameKey];
        console.log(`\nGame: ${gameKey}`);
        console.log('Tracker state:', tracker);
        
        // Find the corresponding game in allScores
        const game = allScores.find(g => 
            g.sport === 'mlb' && 
            (g.awayTeam + ' vs ' + g.homeTeam).includes(gameKey) ||
            gameKey.includes(g.awayTeam) || gameKey.includes(g.homeTeam)
        );
        
        if (game) {
            console.log('Current game state:', {
                inning: game.inningNumber,
                topBottom: game.topBottom,
                outs: game.outs,
                status: game.status
            });
        } else {
            console.log('Could not find matching game in allScores');
        }
    });
    
    console.log('=== END HYBRID DEBUG ===');
}

// Function to test outs tracking and see what's happening
function testOutsTracking() {
    console.log('=== TESTING OUTS TRACKING ===');
    
    if (!window.inningTracker) {
        console.log('No inning tracker initialized yet');
        return;
    }
    
    Object.keys(window.inningTracker).forEach(gameKey => {
        const tracker = window.inningTracker[gameKey];
        console.log(`\nGame: ${gameKey}`);
        console.log('Tracker state:', tracker);
        
        // Find the corresponding game in allScores
        const game = allScores.find(g => 
            g.sport === 'mlb' && 
            (g.awayTeam + ' vs ' + g.homeTeam).includes(gameKey) ||
            gameKey.includes(g.awayTeam) || gameKey.includes(g.homeTeam)
        );
        
        if (game) {
            console.log('Current game state:', {
                inning: game.inningNumber,
                topBottom: game.topBottom,
                outs: game.outs,
                status: game.status
            });
            
            // Check if we should be flipping
            if (tracker.lastOuts === 3 && game.outs === 0) {
                console.log('🎯 SHOULD FLIP: lastOuts was 3 and current outs is 0');
                if (tracker.lastTopBottom === 'bot') {
                    console.log('Should go from bottom → next inning top');
                } else if (tracker.lastTopBottom === 'top') {
                    console.log('Should go from top → bottom');
                }
            } else {
                console.log('❌ NOT FLIPPING: condition not met');
                console.log(`Last outs: ${tracker.lastOuts}, Current outs: ${game.outs}`);
                console.log(`Need: lastOuts === 3 AND current outs === 0`);
                console.log(`This means: we need to see 3 outs, then 0 outs to flip`);
            }
            
            // Show what would happen if we manually triggered a flip
            console.log(`\n🔮 MANUAL FLIP TEST:`);
            if (tracker.lastTopBottom === 'top') {
                console.log(`If we were in top of inning ${tracker.lastInning}, we should go to bottom of inning ${tracker.lastInning}`);
            } else if (tracker.lastTopBottom === 'bot') {
                console.log(`If we were in bottom of inning ${tracker.lastInning}, we should go to top of inning ${tracker.lastInning + 1}`);
            }
        } else {
            console.log('Could not find matching game in allScores');
        }
    });
    
    console.log('=== END TESTING ===');
}

// Function to manually test the flipping logic
function testFlippingLogic() {
    console.log('=== TESTING FLIPPING LOGIC ===');
    
    if (!window.inningTracker) {
        console.log('No inning tracker initialized yet');
        return;
    }
    
    Object.keys(window.inningTracker).forEach(gameKey => {
        const tracker = window.inningTracker[gameKey];
        console.log(`\nGame: ${gameKey}`);
        console.log('Current tracker state:', tracker);
        
        // Simulate what should happen
        console.log(`\n🔮 SIMULATING FLIP LOGIC:`);
        console.log(`Current: inning ${tracker.lastInning} ${tracker.lastTopBottom}, outs: ${tracker.lastOuts}`);
        
        if (tracker.lastTopBottom === 'top') {
            console.log(`If we flip from top: inning ${tracker.lastInning} top → inning ${tracker.lastInning} bottom`);
        } else if (tracker.lastTopBottom === 'bot') {
            console.log(`If we flip from bottom: inning ${tracker.lastInning} bottom → inning ${tracker.lastInning + 1} top`);
        }
        
        // Check if we're in a state where flipping should happen
        if (tracker.lastOuts === 3) {
            console.log(`🎯 READY TO FLIP: We have 3 outs, waiting for 0 outs to trigger flip`);
        } else if (tracker.lastOuts === 0) {
            console.log(`🔄 RESET STATE: We have 0 outs, waiting for outs to increase`);
        } else {
            console.log(`📊 BUILDING OUTS: We have ${tracker.lastOuts} outs, need ${3 - tracker.lastOuts} more to reach 3`);
        }
    });
    
    console.log('=== END FLIPPING TEST ===');
}

// Test function for MLB inning states including between innings and end of innings
function testMLBInningStates() {
    console.log('=== TESTING MLB INNING STATES ===');
    
    // Find all MLB games
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    console.log(`Found ${mlbGames.length} MLB games`);
    
    mlbGames.forEach((game, index) => {
        console.log(`\nMLB Game ${index + 1}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log('Status:', game.status);
        console.log('Top/Bottom:', game.topBottom);
        console.log('Inning Number:', game.inningNumber);
        console.log('Period:', game.period);
        
        // Test the inning display
        const inningDisplay = getGameTimeDisplay(game);
        console.log('Inning Display:', inningDisplay);
        
        // Show what the inning state means
        let inningStateMeaning = '';
        if (game.topBottom === 'top') inningStateMeaning = 'Top of inning';
        else if (game.topBottom === 'bot') inningStateMeaning = 'Bottom of inning';
        else if (game.topBottom === 'mid') inningStateMeaning = 'Between innings';
        else if (game.topBottom === 'end') inningStateMeaning = 'End of inning';
        else inningStateMeaning = 'Unknown';
        
        console.log('Inning State Meaning:', inningStateMeaning);
    });
    
    console.log('=== END INNING STATES TESTING ===');
}

// Debug function to check count data for MLB games
function debugMLBCountData() {
    console.log('=== DEBUGGING MLB COUNT DATA ===');
    
    // Find all MLB games
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    console.log(`Found ${mlbGames.length} MLB games`);
    
    mlbGames.forEach((game, index) => {
        console.log(`\nMLB Game ${index + 1}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log('Balls:', game.balls);
        console.log('Strikes:', game.strikes);
        console.log('Outs:', game.outs);
        console.log('Bases:', game.bases);
        
        // Test the count dots function
        const countDots = getCountDotsVisual(game);
        console.log('Count Dots HTML:', countDots);
    });
    
    console.log('=== END COUNT DATA DEBUGGING ===');
}

// Get clean inning display for header
function getInningDisplay(game) {
    if (game.sport !== 'mlb') return '';
    
    console.log('=== getInningDisplay DEBUG ===');
    console.log('Game:', game.awayTeam, 'vs', game.homeTeam);
    console.log('Inning number:', game.inningNumber);
    console.log('Top/bottom:', game.topBottom);
    console.log('Status:', game.status);
    console.log('Raw game object:', game);
    
    if (game.inningNumber && game.inningNumber > 0) {
        const inningText = game.inningNumber === 1 ? '1st' : 
                          game.inningNumber === 2 ? '2nd' : 
                          game.inningNumber === 3 ? '3rd' : 
                          `${game.inningNumber}th`;
        
        let inningState = '';
        if (game.topBottom === 'top') {
            inningState = 'top';
        } else if (game.topBottom === 'bot' || game.topBottom === 'bottom') {
            inningState = 'bot';
        } else if (game.topBottom === 'mid' || game.topBottom === 'middle') {
            inningState = 'mid';
        } else if (game.topBottom === 'end' || game.topBottom === 'end') {
            inningState = 'end';
        } else {
            // If topBottom is not set, try to infer from the game state
            console.log('No topBottom found, trying to infer from game state...');
            
            // Check if we can infer from the status description or other clues
            if (game.status === 'live') {
                // For live games, try to determine if it's top or bottom based on inning number
                // This is a fallback - ideally the API should provide this info
                if (game.inningNumber <= 9) {
                    // Early innings are usually top, later innings might be bottom
                    inningState = game.inningNumber <= 5 ? 'top' : 'bot';
                    console.log(`Inferred inning state: ${inningState} (inning ${game.inningNumber})`);
                } else {
                    // Extra innings - default to top
                    inningState = 'top';
                    console.log(`Extra innings detected, defaulting to top`);
                }
            } else {
                // For non-live games, default to top
                inningState = 'top';
                console.log(`Non-live game, defaulting to top`);
            }
        }
        
        const result = `${inningState} ${inningText}`;
        console.log(`Final inning display: "${result}"`);
        console.log('=== END getInningDisplay DEBUG ===');
        return result;
    }
    
    console.log('No inning number found');
    console.log('=== END getInningDisplay DEBUG ===');
    return '';
}

// Get clean football display for header (quarter and time)
function getFootballDisplay(game) {
    if (game.sport !== 'nfl' && game.sport !== 'college-football') return '';
    
    console.log(`=== FOOTBALL DISPLAY DEBUG ===`);
    console.log('Game:', game.awayTeam, 'vs', game.homeTeam);
    console.log('Period:', game.period);
    console.log('Clock:', game.clock);
    console.log('Clock type:', typeof game.clock);
    console.log('Clock value:', game.clock);
    
    let quarterText = '';
    if (game.period) {
        if (game.period === 1) quarterText = '1st';
        else if (game.period === 2) quarterText = '2nd';
        else if (game.period === 3) quarterText = '3rd';
        else if (game.period === 4) quarterText = '4th';
        else if (game.period > 4) quarterText = `${game.period}th`;
        else quarterText = game.period.toString();
    }
    
    let timeText = '';
    if (game.clock) {
        // Convert to string first, then format time to be more human-readable
        const clockStr = String(game.clock);
        console.log('Clock string:', clockStr);
        console.log('Clock string length:', clockStr.length);

        if (clockStr.includes(':')) {
            // Already formatted (e.g., "12:45")
            timeText = clockStr;
            console.log('Already formatted time:', timeText);
        } else {
            // Convert seconds to MM:SS format
            const totalSeconds = parseInt(clockStr);
            if (!isNaN(totalSeconds)) {
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                console.log(`Converted ${totalSeconds} seconds to ${timeText}`);
            } else {
                timeText = clockStr;
                console.log('Could not parse as number, using raw value:', timeText);
            }
        }
    }
    
    const result = quarterText && timeText ? `${timeText} ${quarterText}` : 
                   quarterText ? quarterText : 
                   timeText ? timeText : '';
    
    console.log('Final result:', result);
    console.log('=== END FOOTBALL DISPLAY DEBUG ===');
    
    return result;
}

// Debug function to check inning parsing for MLB games
function debugMLBInningParsing() {
    console.log('=== DEBUGGING MLB INNING PARSING ===');
    
    // Find all MLB games
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    console.log(`Found ${mlbGames.length} MLB games`);
    
    mlbGames.forEach((game, index) => {
        console.log(`\nMLB Game ${index + 1}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log('Raw inning data:', {
            inningNumber: game.inningNumber,
            topBottom: game.topBottom,
            period: game.period
        });
        
        // Test the inning display
        const inningDisplay = getInningDisplay(game);
        console.log('Final inning display:', inningDisplay);
        
        // Show what the inning state means
        if (game.topBottom === 'top') {
            console.log('State: Top of inning (away team batting)');
        } else if (game.topBottom === 'bot') {
            console.log('State: Bottom of inning (home team batting)');
        } else if (game.topBottom === 'mid') {
            console.log('State: Middle of inning (between top and bottom)');
        } else if (game.topBottom === 'end') {
            console.log('State: End of inning');
        } else {
            console.log('State: Unknown inning state');
        }
    });
    
    console.log('=== END MLB INNING PARSING DEBUG ===');
}

// Debug function to force refresh and see what changes
function debugForceRefresh() {
    console.log('=== FORCING REFRESH FOR DEBUG ===');
    console.log('Current time:', new Date().toISOString());
    
    // Clear any cached data
    if (window.previousScores) {
        console.log('Clearing previous scores cache');
        window.previousScores = {};
    }
    
    // Force a fresh load
    loadAllScores(false).then(() => {
        console.log('Fresh load complete, checking for changes...');
        debugMLBInningParsing();
    });
}

// Function to manually set sample bases/outs data for testing display
function setSampleMLBBases() {
    console.log('=== SETTING SAMPLE MLB BASES DATA ===');
    
    // Find the first live MLB game
    const liveMLBGame = allScores.find(game => game.sport === 'mlb' && game.status === 'live');
    
    if (!liveMLBGame) {
        console.log('No live MLB game found. Try refreshing the page or wait for a live game.');
        return;
    }
    
    console.log(`Setting sample data for: ${liveMLBGame.awayTeam} vs ${liveMLBGame.homeTeam}`);
    
    // Set sample bases and outs data
    liveMLBGame.bases = 'loaded';
    liveMLBGame.outs = 2;
    
    console.log('Sample data set:', {
        bases: liveMLBGame.bases,
        outs: liveMLBGame.outs
    });
    
    // Test the display
    const inningDisplay = getGameTimeDisplay(liveMLBGame);
    console.log('New inning display:', inningDisplay);
    
    // Refresh the display
    displayScores(allScores);
    
    console.log('=== END SETTING SAMPLE DATA ===');
}

// Test function specifically for bases and outs display
function testMLBBasesAndOuts() {
    console.log('=== TESTING MLB BASES AND OUTS ===');
    
    // Find all MLB games
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    console.log(`Found ${mlbGames.length} MLB games`);
    
    mlbGames.forEach((game, index) => {
        console.log(`\nMLB Game ${index + 1}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log('Bases:', game.bases);
        console.log('Outs:', game.outs);
        console.log('Bases Visual:', getBasesVisual(game.bases));
        
        // Test the full inning display
        const inningDisplay = getGameTimeDisplay(game);
        console.log('Full Inning Display:', inningDisplay);
    });
    
    console.log('=== END BASES AND OUTS TESTING ===');
}

// Debug function to examine competition.situation object for MLB games
function debugMLBCompetitionSituation() {
    console.log('=== DEBUGGING MLB COMPETITION SITUATION ===');
    
    // Find all MLB games
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    console.log(`Found ${mlbGames.length} MLB games`);
    
    if (mlbGames.length === 0) {
        console.log('No MLB games found in allScores. Try refreshing the page first.');
        return;
    }
    
    mlbGames.forEach((game, index) => {
        console.log(`\nMLB Game ${index + 1}: ${game.awayTeam} vs ${game.homeTeam}`);
        console.log('Current parsed data:', {
            bases: game.bases,
            outs: game.outs,
            inningNumber: game.inningNumber,
            topBottom: game.topBottom
        });
    });
    
    console.log('\nTo see the raw ESPN API response structure, check the console logs above for "MLB competition situation found:" messages.');
    console.log('=== END DEBUGGING ===');
}

// Function to examine the raw ESPN API response for a specific live MLB game
function examineLiveMLBResponse() {
    console.log('=== EXAMINING LIVE MLB API RESPONSE ===');
    
    // Find the first live MLB game
    const liveMLBGame = allScores.find(game => game.sport === 'mlb' && game.status === 'live');
    
    if (!liveMLBGame) {
        console.log('No live MLB game found. Try refreshing the page or wait for a live game.');
        return;
    }
    
    console.log(`Examining live game: ${liveMLBGame.awayTeam} vs ${liveMLBGame.homeTeam}`);
    
    // This will show the raw API response structure in the console
    console.log('Check the console logs above for "MLB competition situation found:" messages to see the raw API structure.');
    console.log('Look for the "Full situation object keys:" and "Situation object values:" logs.');
    
    console.log('=== END EXAMINATION ===');
}

// Test function with sample MLB data to verify bases detection
function testMLBBasesDetection() {
    console.log('=== TESTING MLB BASES DETECTION WITH SAMPLE DATA ===');
    
    // Create sample MLB game data
    const sampleGame = {
        sport: 'mlb',
        sportName: 'MLB',
        awayTeam: 'Test Team A',
        homeTeam: 'Test Team B',
        awayScore: '2',
        homeScore: '1',
        status: 'live',
        period: 3,
        inningNumber: 3,
        topBottom: 'bottom',
        bases: 'loaded',
        outs: 2,
        time: 'Live',
        displayDate: 'Today',
        displayTime: '7:30 PM'
    };
    
    console.log('Sample game data:', sampleGame);
    
    // Test the inning display
    const inningDisplay = getGameTimeDisplay(sampleGame);
    console.log('Sample game inning display:', inningDisplay);
    
    // Test bases visual
    const visualBases = getBasesVisual(sampleGame.bases);
    console.log('Sample game bases visual:', visualBases);
    
    console.log('=== END SAMPLE DATA TESTING ===');
}

// Function to manually test bases display by setting sample data
function setSampleMLBBases() {
    console.log('=== SETTING SAMPLE MLB BASES FOR TESTING ===');
    
    // Find the first MLB game and set sample bases/outs
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    if (mlbGames.length > 0) {
        const testGame = mlbGames[0];
        testGame.bases = 'loaded';
        testGame.outs = 2;
        testGame.inningNumber = 5;
        testGame.topBottom = 'bottom';
        
        console.log('Set sample data for:', testGame.awayTeam, 'vs', testGame.homeTeam);
        console.log('Bases:', testGame.bases, 'Outs:', testGame.outs);
        
        // Refresh the display
        filterScores();
        
        // Test the display
        testMLBBasesAndOuts();
    } else {
        console.log('No MLB games found to test with');
    }
    
    console.log('=== END SAMPLE SETTING ===');
}

// Enhanced MLB status detection
function isMLBGameLive(event) {
    // Check if this is an MLB game
    const isMLB = event.leagues && event.leagues[0] && event.leagues[0].slug === 'mlb';
    if (!isMLB) {
        // Also check if the sport is baseball
        if (event.sport && event.sport.toLowerCase().includes('baseball')) {
            console.log(`Baseball game detected: ${event.name}`);
        } else {
            return false;
        }
    }
    
    const status = event.status;
    if (!status || !status.type) return false;
    
    const state = status.type.state;
    const description = status.type.description || '';
    const period = status.period;
    const clock = status.clock;
    
    console.log(`MLB status check for ${event.name}:`, { state, description, period, clock });
    
    // MLB games are live if:
    // 1. State is 'in' (in progress)
    // 2. Has period > 0 (inning number)
    // 3. Description contains inning-related text
    if (state === 'in' && period && period > 0) {
        console.log(`MLB game ${event.name} is LIVE - Inning ${period}`);
        return true;
    }
    
    // Check if description indicates live play
    if (state === 'in' && (
        description.toLowerCase().includes('inning') ||
        description.toLowerCase().includes('top') ||
        description.toLowerCase().includes('bottom') ||
        description.toLowerCase().includes('live') ||
        description.toLowerCase().includes('in progress'))) {
        console.log(`MLB game ${event.name} is LIVE - ${description}`);
        return true;
    }
    
    // Check if there are scores that suggest the game has started
    const competition = event.competitions?.[0];
    if (competition && competition.competitors && state === 'in') {
        const hasScores = competition.competitors.some(comp => 
            comp.score && comp.score !== '0' && comp.score !== '');
        if (hasScores) {
            console.log(`MLB game ${event.name} is LIVE - Has scores and state is 'in'`);
            return true;
        }
    }
    
    // Additional check: if state is 'in' and we have any competition data, likely live
    if (state === 'in' && competition) {
        console.log(`MLB game ${event.name} is LIVE - State 'in' with competition data`);
        return true;
    }
    
    return false;
}

// Get game status display text

// Log MLB game data for debugging
function logMLBGameData(mlbScores) {
    if (mlbScores.length === 0) {
        console.log('No MLB scores to log');
        return;
    }
    
    console.log('=== MLB GAMES DATA DEBUG ===');
    mlbScores.forEach((game, index) => {
        console.log(`MLB Game ${index + 1}:`, {
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            awayScore: game.awayScore,
            homeScore: game.homeScore,
            status: game.status,
            period: game.period,
            inningNumber: game.inningNumber,
            topBottom: game.topBottom,
            bases: game.bases,
            outs: game.outs,
            time: game.time,
            displayTime: game.displayTime,
            fullGame: game
        });
    });
    console.log('=== END MLB DEBUG ===');
}

// Enhanced MLB status detection

// Get visual representation of NFL field for live games
function getNFLFieldVisual(game) {
    return '';
}

// Test function to debug inning display issues
function testInningDisplay() {
    console.log('=== TESTING INNING DISPLAY ===');
    
    // Find all MLB games
    const mlbGames = allScores.filter(game => game.sport === 'mlb');
    console.log(`Found ${mlbGames.length} MLB games`);
    
    if (mlbGames.length === 0) {
        console.log('No MLB games found. Try refreshing the scores first.');
        return;
    }
    
    mlbGames.forEach((game, index) => {
        console.log(`\n--- MLB Game ${index + 1} ---`);
        console.log(`${game.awayTeam} vs ${game.homeTeam}`);
        console.log('Status:', game.status);
        console.log('Inning Number:', game.inningNumber);
        console.log('Top/Bottom:', game.topBottom);
        console.log('Bases:', game.bases);
        console.log('Outs:', game.outs);
        
        // Test the inning display function
        const inningDisplay = getInningDisplay(game);
        console.log('Inning Display Result:', inningDisplay);
        
        // Show what should be displayed
        if (game.status === 'live' && game.inningNumber) {
            console.log('Should show in header:', inningDisplay);
        } else if (game.status === 'final') {
            console.log('Should show in header: FINAL');
        } else {
            console.log('Should show in header:', game.displayTime || game.time || 'TBD');
        }
    });
    
    console.log('\n=== END INNING DISPLAY TEST ===');
}

// Make the test function available globally
window.testInningDisplay = testInningDisplay;

