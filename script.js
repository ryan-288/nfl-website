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

// Open game summary page when clicking on a game card
function openGameSummary(sport, awayTeam, homeTeam, gameId) {
    console.log('Opening game summary for:', sport, awayTeam, 'vs', homeTeam, 'ID:', gameId);
    
    // Store game data in sessionStorage for the summary page
    const gameData = {
        sport: sport,
        awayTeam: awayTeam,
        homeTeam: homeTeam,
        gameId: gameId,
        timestamp: new Date().toISOString()
    };
    
    sessionStorage.setItem('currentGame', JSON.stringify(gameData));
    
    // Navigate to game summary page
    window.location.href = 'game-summary.html';
}

// ESPN API endpoints
const ESPN_APIS = {
    'nfl': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    'nba': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    'mlb': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    'nhl': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    'college-football': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
    'college-basketball': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
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
            
            // PRIMARY: Get inning info from status.type.detail and shortDetail (most reliable)
            if (event.status?.type?.detail || event.status?.type?.shortDetail) {
                const detail = event.status.type.detail || event.status.type.shortDetail;
                const detailLower = detail.toLowerCase();
                console.log(`MLB status detail: "${detail}"`);
                
                // Extract inning number and top/bottom from detail
                const inningMatch = detailLower.match(/(\d+)(?:st|nd|rd|th)/);
                if (inningMatch) {
                    inningNumber = parseInt(inningMatch[1]);
                    console.log(`Found inning number from detail: ${inningNumber}`);
                }
                
                // Determine top/bottom from detail
                if (detailLower.includes('top')) {
                    topBottom = 'top';
                    console.log('Found top from detail');
                } else if (detailLower.includes('bottom') || detailLower.includes('bot')) {
                    topBottom = 'bot';
                    console.log('Found bottom from detail');
                } else if (detailLower.includes('between') || detailLower.includes('middle') || detailLower.includes('mid')) {
                    topBottom = 'mid';
                    console.log('Found middle from detail');
                } else if (detailLower.includes('end') || detailLower.includes('ended')) {
                    topBottom = 'end';
                    console.log('Found end from detail');
                }
            }
            
            // FALLBACK: Try to get inning info from status description
            if (!inningNumber && event.status?.type?.description) {
                const description = event.status.type.description.toLowerCase();
                console.log(`MLB status description fallback: "${description}"`);
                
                // Extract inning number from description (e.g., "Top 3rd", "Bottom 5th")
                const inningMatch = description.match(/(\d+)(?:st|nd|rd|th)/);
                if (inningMatch) {
                    inningNumber = parseInt(inningMatch[1]);
                    console.log(`Found inning number from description: ${inningNumber}`);
                }
                
                // Enhanced inning state detection from description
                if (!topBottom) {
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
                    }
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
            
            // SECONDARY: Try to get more reliable inning info from competition.situation object
            if (competition?.situation) {
                console.log(`MLB competition situation found:`, competition.situation);
                
                // Parse situation object for inning, balls, strikes, outs, and base runners
                const situation = competition.situation;
                
                // Extract inning info if not already found
                if (!inningNumber && situation.inning !== undefined && situation.inning !== null) {
                    inningNumber = situation.inning;
                    console.log(`Found inning from situation: ${inningNumber}`);
                }
                
                // Extract top/bottom info if not already found
                if (!topBottom) {
                    if (situation.topOfInning !== undefined && situation.topOfInning !== null) {
                        topBottom = situation.topOfInning ? 'top' : 'bot';
                        console.log(`Found topOfInning from situation: ${situation.topOfInning} -> ${topBottom}`);
                    }
                    // Fallback to inningHalf
                    else if (situation.inningHalf !== undefined && situation.inningHalf !== null) {
                        if (situation.inningHalf === 1 || situation.inningHalf === 'top') {
                            topBottom = 'top';
                        } else if (situation.inningHalf === 2 || situation.inningHalf === 'bottom') {
                            topBottom = 'bot';
                        }
                        console.log(`Found inningHalf: ${situation.inningHalf} -> ${topBottom}`);
                    }
                    // Fallback to inningState
                    else if (situation.inningState !== undefined && situation.inningState !== null) {
                        const state = situation.inningState.toString().toLowerCase();
                        if (state.includes('top') || state === '1') {
                            topBottom = 'top';
                        } else if (state.includes('bottom') || state.includes('bot') || state === '2') {
                            topBottom = 'bot';
                        }
                        console.log(`Found inningState: ${situation.inningState} -> ${topBottom}`);
                    }
                }
                
                // Extract balls, strikes, and outs
                if (situation.balls !== undefined && situation.balls !== null) {
                    balls = situation.balls;
                    console.log(`Found balls from situation: ${balls}`);
                }
                
                if (situation.strikes !== undefined && situation.strikes !== null) {
                    strikes = situation.strikes;
                    console.log(`Found strikes from situation: ${strikes}`);
                }
                
                if (situation.outs !== undefined && situation.outs !== null) {
                    outs = situation.outs;
                    console.log(`Found outs from situation: ${outs}`);
                }
                
                // Extract base runners information
                const baseRunners = [];
                if (situation.onFirst) baseRunners.push('1st');
                if (situation.onSecond) baseRunners.push('2nd');
                if (situation.onThird) baseRunners.push('3rd');
                
                if (baseRunners.length > 0) {
                    bases = baseRunners.join(', ');
                    console.log(`Found base runners: ${bases}`);
                }
                
                // Log additional situation data for debugging
                console.log('=== SITUATION DETAILS ===');
                console.log('Balls:', balls);
                console.log('Strikes:', strikes);
                console.log('Outs:', outs);
                console.log('Base runners:', bases);
                console.log('=== END SITUATION DETAILS ===');
                
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
            description: event.status?.type?.description || '',
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
        'college-basketball': 'College Basketball'
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
    
    // Special debugging for NHL games
    if (event.sport === 'nhl' || (event.leagues && event.leagues[0] && event.leagues[0].slug === 'nhl')) {
        console.log('🏒 NHL Game Status Debug:', {
            name: event.name,
            state: state,
            description: description,
            period: period,
            clock: clock,
            isStateIn: state === 'in',
            hasPeriod: period && period > 0,
            hasClock: clock && clock !== '0:00' && clock !== '' && clock !== '0' && clock !== 0
        });
    }
    
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
    
    // Check if game is live/in progress - improved detection for all sports
    if (state === 'in' && (
        description.toLowerCase().includes('quarter') ||
        description.toLowerCase().includes('period') ||
        description.toLowerCase().includes('inning') ||
        description.toLowerCase().includes('top') ||
        description.toLowerCase().includes('bottom') ||
        description.toLowerCase().includes('live') ||
        description.toLowerCase().includes('in progress') ||
        (period && period > 0) ||
        (clock && clock !== '0:00' && clock !== '' && clock !== '0' && clock !== 0))) {
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
            <div class="score-card ${changeClass}" data-game-id="${game.sport}-${game.awayTeam}-${game.homeTeam}" onclick="openGameSummary('${game.sport}', '${game.awayTeam}', '${game.homeTeam}', '${game.id}')">
                <div class="game-header">
                    <span class="sport-type">${game.sport}</span>
                    ${game.sport === 'mlb' && game.status === 'live' && game.inningNumber ? `<span class="inning-display live">${getInningDisplay(game)}</span>` : ''}
                    ${game.sport === 'mlb' && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
                    ${(game.sport === 'nfl' || game.sport === 'college-football') && game.status === 'live' && game.period ? `<span class="inning-display live">${getFootballDisplay(game)}</span>` : ''}
                    ${(game.sport === 'nfl' || game.sport === 'college-football') && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
                    ${(game.sport === 'nba' || game.sport === 'ncaab') && game.status === 'live' ? `<span class="inning-display live">${getNBADisplay(game)}</span>` : ''}
                    ${(game.sport === 'nba' || game.sport === 'ncaab') && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
                    ${(game.sport === 'nhl') && game.status === 'live' ? `<span class="inning-display live">${getNHLDisplay(game)}</span>` : ''}
                    ${(game.sport === 'nhl') && game.status === 'final' ? `<span class="inning-display final">FINAL</span>` : ''}
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
                    
                    ${game.sport === 'mlb' && game.status === 'live' ? `<div class="mlb-game-state live-game">
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
    
    // If we're going back to current week (offset 0), use today's date
    if (currentWeekOffset === 0) {
        currentDate = new Date(); // Use today's date
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayName = dayNames[currentDate.getDay()];
        
        // Update active button to show today as selected
        updateActiveButtons(currentDayName);
    } else {
        // For previous weeks, use Sunday
        const today = new Date();
        const sunday = new Date(today);
        const dayOfWeek = today.getDay();
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        sunday.setDate(today.getDate() + daysToSunday + (currentWeekOffset * 7));
        currentDate = sunday;
        
        // Update active button to show Sunday as selected
        updateActiveButtons('sunday');
    }
    
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
    
    // If we're going back to current week (offset 0), use today's date
    if (currentWeekOffset === 0) {
        currentDate = new Date(); // Use today's date
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayName = dayNames[currentDate.getDay()];
        
        // Update active button to show today as selected
        updateActiveButtons(currentDayName);
    } else {
        // For future weeks, use Monday
        const today = new Date();
        const monday = new Date(today);
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        monday.setDate(today.getDate() - daysToMonday + (currentWeekOffset * 7));
        currentDate = monday;
        
        // Update active button to show Monday as selected
        updateActiveButtons('monday');
    }
    
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
    
    if (currentWeekOffset === 0) {
        weekLabel.textContent = 'Current Week';
    } else if (currentWeekOffset < 0) {
        weekLabel.textContent = `${Math.abs(currentWeekOffset)} Week${Math.abs(currentWeekOffset) > 1 ? 's' : ''} Ago`;
    } else {
        weekLabel.textContent = `${currentWeekOffset} Week${currentWeekOffset > 1 ? 's' : ''} Ahead`;
    }
    
    // Calculate the Monday of the target week (needed for week button calculations)
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 1, Sunday = 0
    
    monday.setDate(today.getDate() - daysToMonday + (currentWeekOffset * 7));
    
    // Store the Monday of the current week for week button calculations
    window.currentWeekMonday = monday;
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
    
    // Handle team tile clicks for team page
    if (e.target.closest('.team')) {
        console.log('Team clicked!', e.target);
        const gameCard = e.target.closest('.score-card');
        const gameId = gameCard.getAttribute('data-game-id');
        const sport = gameId.split('-')[0];
        
        // Get team name from the team tile
        const teamElement = e.target.closest('.team');
        const teamNameElement = teamElement.querySelector('.team-name');
        const teamName = teamNameElement ? teamNameElement.textContent.trim() : '';

        console.log('Navigating to team page:', sport, teamName);
        // Navigate to team page with sport filter and team name
        window.location.href = `team.html?sport=${sport}&team=${encodeURIComponent(teamName)}`;
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
             onerror="console.log('Logo failed to load:', '${logoUrl}'); this.style.display='none'; this.nextElementSibling.style.display='flex'; logoCache.set('${cacheKey}', 'FAILED'); this.onerror=null;" 
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

// Test NHL logos function
window.testNHLLogos = function() {
    console.log('🧪 Testing NHL Logos...');
    const testTeams = ['New York Rangers', 'New Jersey Devils', 'Florida Panthers', 'Nashville Predators', 'Toronto Maple Leafs', 'Ottawa Senators', 'Rangers', 'Devils', 'Panthers', 'Predators', 'Maple Leafs', 'Senators'];
    
    testTeams.forEach(team => {
        const logoUrl = getNHLLogoUrl(team);
        console.log(`Team: "${team}" -> Logo: ${logoUrl ? '✅ Found' : '❌ Not found'}`);
        if (logoUrl) console.log(`  URL: ${logoUrl}`);
    });
};

// Debug function to check what team names are actually being used
window.debugNHLTeams = function() {
    console.log('🔍 Debugging NHL Team Names...');
    fetch('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard')
        .then(response => response.json())
        .then(data => {
            console.log('Current NHL games:');
            data.events.forEach(game => {
                console.log(`Game: ${game.name}`);
                if (game.competitions && game.competitions[0] && game.competitions[0].competitors) {
                    game.competitions[0].competitors.forEach(competitor => {
                        const teamName = competitor.team.displayName;
                        console.log(`  Team: "${teamName}"`);
                        const logoUrl = getNHLLogoUrl(teamName);
                        console.log(`    Logo: ${logoUrl ? '✅ Found' : '❌ Not found'}`);
                    });
                }
            });
        })
        .catch(error => console.error('Error fetching NHL data:', error));
};

// Test all NHL logo URLs to find broken ones
window.testAllNHLLogos = function() {
    console.log('🧪 Testing All NHL Logo URLs...');
    const allNHLTeams = [
        'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres', 'Calgary Flames',
        'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche', 'Columbus Blue Jackets',
        'Dallas Stars', 'Detroit Red Wings', 'Edmonton Oilers', 'Florida Panthers', 'Los Angeles Kings',
        'Minnesota Wild', 'Montreal Canadiens', 'Nashville Predators', 'New Jersey Devils',
        'New York Islanders', 'New York Rangers', 'Ottawa Senators', 'Philadelphia Flyers',
        'Pittsburgh Penguins', 'San Jose Sharks', 'Seattle Kraken', 'St. Louis Blues',
        'Tampa Bay Lightning', 'Toronto Maple Leafs', 'Vancouver Canucks', 'Vegas Golden Knights',
        'Washington Capitals', 'Winnipeg Jets'
    ];
    
    allNHLTeams.forEach(team => {
        const logoUrl = getNHLLogoUrl(team);
        if (logoUrl) {
            fetch(logoUrl, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        console.log(`✅ ${team}: ${logoUrl}`);
                    } else {
                        console.log(`❌ ${team}: ${logoUrl} (${response.status})`);
                    }
                })
                .catch(error => {
                    console.log(`❌ ${team}: ${logoUrl} (Failed to fetch)`);
                });
        } else {
            console.log(`❌ ${team}: No logo URL found`);
        }
    });
};

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
        'college-basketball': '#9932CC' // Purple for College Basketball
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
    console.log(`🔍 NHL logo search for: "${teamName}"`);
    
    const nhlLogos = {
        // Full team names - Using ESPN logo URLs
        'Anaheim Ducks': 'https://a.espncdn.com/i/teamlogos/nhl/500/ana.png',
        'Arizona Coyotes': 'https://a.espncdn.com/i/teamlogos/nhl/500/ari.png',
        'Boston Bruins': 'https://a.espncdn.com/i/teamlogos/nhl/500/bos.png',
        'Buffalo Sabres': 'https://a.espncdn.com/i/teamlogos/nhl/500/buf.png',
        'Calgary Flames': 'https://a.espncdn.com/i/teamlogos/nhl/500/cgy.png',
        'Carolina Hurricanes': 'https://a.espncdn.com/i/teamlogos/nhl/500/car.png',
        'Chicago Blackhawks': 'https://a.espncdn.com/i/teamlogos/nhl/500/chi.png',
        'Colorado Avalanche': 'https://a.espncdn.com/i/teamlogos/nhl/500/col.png',
        'Columbus Blue Jackets': 'https://a.espncdn.com/i/teamlogos/nhl/500/cbj.png',
        'Dallas Stars': 'https://a.espncdn.com/i/teamlogos/nhl/500/dal.png',
        'Detroit Red Wings': 'https://a.espncdn.com/i/teamlogos/nhl/500/det.png',
        'Edmonton Oilers': 'https://a.espncdn.com/i/teamlogos/nhl/500/edm.png',
        'Florida Panthers': 'https://a.espncdn.com/i/teamlogos/nhl/500/fla.png',
        'Los Angeles Kings': 'https://a.espncdn.com/i/teamlogos/nhl/500/la.png',
        'Minnesota Wild': 'https://a.espncdn.com/i/teamlogos/nhl/500/min.png',
        'Montreal Canadiens': 'https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png',
        'Nashville Predators': 'https://a.espncdn.com/i/teamlogos/nhl/500/nsh.png',
        'New Jersey Devils': 'https://a.espncdn.com/i/teamlogos/nhl/500/njd.png',
        'New York Islanders': 'https://a.espncdn.com/i/teamlogos/nhl/500/nyi.png',
        'New York Rangers': 'https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png',
        'Ottawa Senators': 'https://a.espncdn.com/i/teamlogos/nhl/500/ott.png',
        'Philadelphia Flyers': 'https://a.espncdn.com/i/teamlogos/nhl/500/phi.png',
        'Pittsburgh Penguins': 'https://a.espncdn.com/i/teamlogos/nhl/500/pit.png',
        'San Jose Sharks': 'https://a.espncdn.com/i/teamlogos/nhl/500/sj.png',
        'Seattle Kraken': 'https://a.espncdn.com/i/teamlogos/nhl/500/sea.png',
        'St. Louis Blues': 'https://a.espncdn.com/i/teamlogos/nhl/500/stl.png',
        'Tampa Bay Lightning': 'https://a.espncdn.com/i/teamlogos/nhl/500/tbl.png',
        'Toronto Maple Leafs': 'https://a.espncdn.com/i/teamlogos/nhl/500/tor.png',
        'Vancouver Canucks': 'https://a.espncdn.com/i/teamlogos/nhl/500/van.png',
        'Vegas Golden Knights': 'https://a.espncdn.com/i/teamlogos/nhl/500/vgk.png',
        'Washington Capitals': 'https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png',
        'Winnipeg Jets': 'https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png',
        
        // Common abbreviations and variations - Using ESPN logo URLs
        'Ducks': 'https://a.espncdn.com/i/teamlogos/nhl/500/ana.png',
        'Coyotes': 'https://a.espncdn.com/i/teamlogos/nhl/500/ari.png',
        'Bruins': 'https://a.espncdn.com/i/teamlogos/nhl/500/bos.png',
        'Sabres': 'https://a.espncdn.com/i/teamlogos/nhl/500/buf.png',
        'Flames': 'https://a.espncdn.com/i/teamlogos/nhl/500/cgy.png',
        'Hurricanes': 'https://a.espncdn.com/i/teamlogos/nhl/500/car.png',
        'Blackhawks': 'https://a.espncdn.com/i/teamlogos/nhl/500/chi.png',
        'Avalanche': 'https://a.espncdn.com/i/teamlogos/nhl/500/col.png',
        'Blue Jackets': 'https://a.espncdn.com/i/teamlogos/nhl/500/cbj.png',
        'Stars': 'https://a.espncdn.com/i/teamlogos/nhl/500/dal.png',
        'Red Wings': 'https://a.espncdn.com/i/teamlogos/nhl/500/det.png',
        'Oilers': 'https://a.espncdn.com/i/teamlogos/nhl/500/edm.png',
        'Panthers': 'https://a.espncdn.com/i/teamlogos/nhl/500/fla.png',
        'Kings': 'https://a.espncdn.com/i/teamlogos/nhl/500/la.png',
        'Wild': 'https://a.espncdn.com/i/teamlogos/nhl/500/min.png',
        'Canadiens': 'https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png',
        'Predators': 'https://a.espncdn.com/i/teamlogos/nhl/500/nsh.png',
        'Devils': 'https://a.espncdn.com/i/teamlogos/nhl/500/njd.png',
        'Islanders': 'https://a.espncdn.com/i/teamlogos/nhl/500/nyi.png',
        'Rangers': 'https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png',
        'Senators': 'https://a.espncdn.com/i/teamlogos/nhl/500/ott.png',
        'Flyers': 'https://a.espncdn.com/i/teamlogos/nhl/500/phi.png',
        'Penguins': 'https://a.espncdn.com/i/teamlogos/nhl/500/pit.png',
        'Sharks': 'https://a.espncdn.com/i/teamlogos/nhl/500/sj.png',
        'Kraken': 'https://a.espncdn.com/i/teamlogos/nhl/500/sea.png',
        'Blues': 'https://a.espncdn.com/i/teamlogos/nhl/500/stl.png',
        'Lightning': 'https://a.espncdn.com/i/teamlogos/nhl/500/tbl.png',
        'Maple Leafs': 'https://a.espncdn.com/i/teamlogos/nhl/500/tor.png',
        'Canucks': 'https://a.espncdn.com/i/teamlogos/nhl/500/van.png',
        'Golden Knights': 'https://a.espncdn.com/i/teamlogos/nhl/500/vgk.png',
        'Capitals': 'https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png',
        'Jets': 'https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png',
        
        // Additional common variations
        'Anaheim': 'https://a.espncdn.com/i/teamlogos/nhl/500/ana.png',
        'Arizona': 'https://a.espncdn.com/i/teamlogos/nhl/500/ari.png',
        'Boston': 'https://a.espncdn.com/i/teamlogos/nhl/500/bos.png',
        'Buffalo': 'https://a.espncdn.com/i/teamlogos/nhl/500/buf.png',
        'Calgary': 'https://a.espncdn.com/i/teamlogos/nhl/500/cgy.png',
        'Carolina': 'https://a.espncdn.com/i/teamlogos/nhl/500/car.png',
        'Chicago': 'https://a.espncdn.com/i/teamlogos/nhl/500/chi.png',
        'Colorado': 'https://a.espncdn.com/i/teamlogos/nhl/500/col.png',
        'Columbus': 'https://a.espncdn.com/i/teamlogos/nhl/500/cbj.png',
        'Dallas': 'https://a.espncdn.com/i/teamlogos/nhl/500/dal.png',
        'Detroit': 'https://a.espncdn.com/i/teamlogos/nhl/500/det.png',
        'Edmonton': 'https://a.espncdn.com/i/teamlogos/nhl/500/edm.png',
        'Florida': 'https://a.espncdn.com/i/teamlogos/nhl/500/fla.png',
        'Los Angeles': 'https://a.espncdn.com/i/teamlogos/nhl/500/la.png',
        'Minnesota': 'https://a.espncdn.com/i/teamlogos/nhl/500/min.png',
        'Montreal': 'https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png',
        'Nashville': 'https://a.espncdn.com/i/teamlogos/nhl/500/nsh.png',
        'New Jersey': 'https://a.espncdn.com/i/teamlogos/nhl/500/njd.png',
        'New York': 'https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png',
        'Ottawa': 'https://a.espncdn.com/i/teamlogos/nhl/500/ott.png',
        'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nhl/500/phi.png',
        'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nhl/500/pit.png',
        'San Jose': 'https://a.espncdn.com/i/teamlogos/nhl/500/sj.png',
        'Seattle': 'https://a.espncdn.com/i/teamlogos/nhl/500/sea.png',
        'St. Louis': 'https://a.espncdn.com/i/teamlogos/nhl/500/stl.png',
        'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nhl/500/tbl.png',
        'Toronto': 'https://a.espncdn.com/i/teamlogos/nhl/500/tor.png',
        'Vancouver': 'https://a.espncdn.com/i/teamlogos/nhl/500/van.png',
        'Vegas': 'https://a.espncdn.com/i/teamlogos/nhl/500/vgk.png',
        'Washington': 'https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png',
        'Winnipeg': 'https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png'
    };
    
    // Try exact match first
    if (nhlLogos[teamName]) {
        console.log(`✅ Found NHL logo for: ${teamName}`);
        return nhlLogos[teamName];
    }
    
    // Try partial matching
    const teamNameLower = teamName.toLowerCase();
    for (const [fullName, logoUrl] of Object.entries(nhlLogos)) {
        const fullNameLower = fullName.toLowerCase();
        if (fullNameLower.includes(teamNameLower) || teamNameLower.includes(fullNameLower)) {
            console.log(`✅ Found NHL partial match: ${teamName} -> ${fullName}`);
                return logoUrl;
        }
    }
    
    console.log(`❌ No NHL logo found for: ${teamName}`);
    return null;
}




// Get College Football logo URLs with comprehensive team database
function getCollegeFootballLogoUrl(teamName) {
    console.log(`🔍 College Football logo search for: "${teamName}"`);
    
    const collegeFootballLogos = {
        '\'Roos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2045.png',
        '49ers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png',
        'AAMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2010.png',
        'Abilene Christian Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2000.png',
        'Abilene Chrstn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2000.png',
        'ACU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2000.png',
        'Adams St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2001.png',
        'Adams State Grizzlies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2001.png',
        'ADR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2003.png',
        'Adrian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2003.png',
        'Adrian Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2003.png',
        'Adrian Saints': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2562.png',
        'ADST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2001.png',
        'AF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'Aggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
        'AIC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2022.png',
        'Air Force': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'Air Force Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        'AKR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
        'Akron': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
        'Akron Zips': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
        'ALA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
        'Alabama': 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
        'Alabama A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2010.png',
        'Alabama A&M Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2010.png',
        'Alabama Crimson Tide': 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
        'Alabama St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2011.png',
        'Alabama State Hornets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2011.png',
        'ALB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2015.png',
        'Albany St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2013.png',
        'Albany State GA Golden Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2013.png',
        'ALBI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2790.png',
        'Albion': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2790.png',
        'Albion Britons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2790.png',
        'Albright': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2015.png',
        'Albright Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2015.png',
        'ALBS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2013.png',
        'ALCN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2016.png',
        'Alcorn St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2016.png',
        'Alcorn State Braves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2016.png',
        'ALF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/365.png',
        'Alfred': 'https://a.espncdn.com/i/teamlogos/ncaa/500/365.png',
        'Alfred St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3162.png',
        'Alfred State Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3162.png',
        'Alfred University Saxons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/365.png',
        'ALFS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3162.png',
        'ALL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2019.png',
        'Allegheny': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2018.png',
        'Allegheny Gators': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2018.png',
        'Allen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2019.png',
        'Allen Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2019.png',
        'ALM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2800.png',
        'Alma': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2800.png',
        'Alma Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2800.png',
        'ALST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2011.png',
        'ALVERNIA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111674.png',
        'Amcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/15.png',
        'American Int\'l': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2022.png',
        'American International Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2022.png',
        'AMH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/7.png',
        'Amherst': 'https://a.espncdn.com/i/teamlogos/ncaa/500/7.png',
        'Amherst Mammoths': 'https://a.espncdn.com/i/teamlogos/ncaa/500/7.png',
        'AND': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129469.png',
        'Anderson (IN) Ravens': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2023.png',
        'Anderson (Sc)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129469.png',
        'Anderson (Sc) Trojans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129469.png',
        'Anderson IN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2023.png',
        'ANG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2025.png',
        'Angelo State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2025.png',
        'Angelo State Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2025.png',
        'ANN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/15.png',
        'Anna Maria': 'https://a.espncdn.com/i/teamlogos/ncaa/500/15.png',
        'Anna Maria College Amcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/15.png',
        'APP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
        'App State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
        'App State Mountaineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
        'APPRE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3111.png',
        'Apprentice': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3111.png',
        'Apprentice School Builders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3111.png',
        'APSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2046.png',
        'AR-Pine Bluff': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2029.png',
        'Argonauts': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110242.png',
        'ARIZ': 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png',
        'Arizona': 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png',
        'Arizona St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'Arizona State Sun Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'Arizona Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png',
        'ARK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
        'Ark-Monticello': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2028.png',
        'ARKAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124386.png',
        'Arkansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
        'Arkansas Bapti': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124386.png',
        'Arkansas Razorbacks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
        'Arkansas St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        'Arkansas State Red Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        'Arkansas Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2033.png',
        'Arkansas Tech Wonder Boys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2033.png',
        'Arkansas-Monticello Boll Weevils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2028.png',
        'Arkansas-Pine Bluff Golden Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2029.png',
        'ARKMONT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2028.png',
        'ARKTECH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2033.png',
        'Army': 'https://a.espncdn.com/i/teamlogos/ncaa/500/349.png',
        'ARMY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/349.png',
        'Army Black Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/349.png',
        'ARST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        'ASH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/308.png',
        'Ashland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/308.png',
        'Ashland Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/308.png',
        'ASP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2038.png',
        'Assumption': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2038.png',
        'Assumption Greyhounds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2038.png',
        'ASU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'AUB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
        'Auburn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
        'Auburn Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
        'AUG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124.png',
        'Auggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124.png',
        'AUGIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2042.png',
        'Augsburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124.png',
        'Augsburg Auggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124.png',
        'Augustana (IL) Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2042.png',
        'Augustana (SD)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2043.png',
        'Augustana IL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2042.png',
        'Augustana University (SD) Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2043.png',
        'AUR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2044.png',
        'Aurora': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2044.png',
        'Aurora Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2044.png',
        'AUS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2045.png',
        'AUSD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2043.png',
        'Austin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2045.png',
        'Austin \'Roos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2045.png',
        'Austin Peay': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2046.png',
        'Austin Peay Governors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2046.png',
        'AVE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2047.png',
        'AVE M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3178.png',
        'Ave Maria': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3178.png',
        'Ave Maria University Gyrenes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3178.png',
        'Averett': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2047.png',
        'Averett Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2047.png',
        'Avila': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2048.png',
        'AVILA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2048.png',
        'Avila University Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2048.png',
        'AZ Christn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108358.png',
        'AZCHR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108358.png',
        'Aztecs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
        'Badgers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
        'BAK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/488.png',
        'Baker': 'https://a.espncdn.com/i/teamlogos/ncaa/500/488.png',
        'Baker University Baker': 'https://a.espncdn.com/i/teamlogos/ncaa/500/488.png',
        'BAL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/188.png',
        'Bald Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/209.png',
        'Bald Wallace': 'https://a.espncdn.com/i/teamlogos/ncaa/500/188.png',
        'Baldwin Wallace Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/188.png',
        'BALL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2050.png',
        'Ball State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2050.png',
        'Ball State Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2050.png',
        'Bantams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2977.png',
        'BAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122666.png',
        'Barton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122666.png',
        'Barton Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122666.png',
        'BAT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/121.png',
        'Bates': 'https://a.espncdn.com/i/teamlogos/ncaa/500/121.png',
        'Bates Bobcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/121.png',
        'Battling Bishops': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2980.png',
        'BAY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png',
        'Baylor': 'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png',
        'Baylor Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png',
        'BBM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2080.png',
        'BC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/103.png',
        'BCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2065.png',
        'Beacons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2674.png',
        'Bearcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2930.png',
        'Bearkats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2534.png',
        'Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/143.png',
        'Beavers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        'BEL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/266.png',
        'BELHA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2056.png',
        'Belhaven': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2056.png',
        'Belhaven Blazers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2056.png',
        'Beloit': 'https://a.espncdn.com/i/teamlogos/ncaa/500/266.png',
        'Beloit Buccaneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/266.png',
        'Bemidji St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/132.png',
        'Bemidji State Beavers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/132.png',
        'BEN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/490.png',
        'BENC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/16111.png',
        'Benedict': 'https://a.espncdn.com/i/teamlogos/ncaa/500/490.png',
        'Benedict College Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/490.png',
        'Benedictine': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2283.png',
        'Benedictine College Ravens': 'https://a.espncdn.com/i/teamlogos/ncaa/500/16111.png',
        'Benedictine University Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2283.png',
        'Bengals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/304.png',
        'BENILL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2283.png',
        'BENT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2060.png',
        'Bentley': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2060.png',
        'Bentley Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2060.png',
        'BER': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2757.png',
        'Berry': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2757.png',
        'Berry College Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2757.png',
        'BET': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2802.png',
        'BETHA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/492.png',
        'Bethany (Ks)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/492.png',
        'Bethany (KS) Bethany (Ks)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/492.png',
        'Bethany (WV)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2062.png',
        'Bethany (WV) Bison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2062.png',
        'Bethany KS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/492.png',
        'Bethel (MN)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2802.png',
        'Bethel (MN) Royals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2802.png',
        'Bethel TN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2064.png',
        'Bethel University Tennessee Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2064.png',
        'BETHTN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2064.png',
        'Bethune': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2065.png',
        'Bethune-Cookman Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2065.png',
        'BETHWV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2062.png',
        'BGSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/189.png',
        'BHST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2069.png',
        'Biddeford Nor\'easters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111675.png',
        'Big Blue': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124180.png',
        'Big Green': 'https://a.espncdn.com/i/teamlogos/ncaa/500/159.png',
        'Big Red': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2171.png',
        'Bison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/319.png',
        'Bisons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2264.png',
        'Black Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/311.png',
        'Black Hills St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2069.png',
        'Black Hills State Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2069.png',
        'Black Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/349.png',
        'Blazers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2673.png',
        'BLMSB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2071.png',
        'Bloomsburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2071.png',
        'Bloomsburg Huskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2071.png',
        'BLU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124180.png',
        'Blue Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2940.png',
        'Blue Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2744.png',
        'Blue Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/316.png',
        'Blue Hens': 'https://a.espncdn.com/i/teamlogos/ncaa/500/48.png',
        'Blue Hose': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2506.png',
        'Blue Jays': 'https://a.espncdn.com/i/teamlogos/ncaa/500/433.png',
        'Blue Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2393.png',
        'Blue Streaks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2302.png',
        'Blue Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2876.png',
        'Blueboys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2286.png',
        'Bluefield': 'https://a.espncdn.com/i/teamlogos/ncaa/500/495.png',
        'BLUEFIELD Ramblin\' Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/495.png',
        'Bluefield St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124180.png',
        'Bluefield State Big Blue': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124180.png',
        'Bluejays': 'https://a.espncdn.com/i/teamlogos/ncaa/500/72.png',
        'Bluffton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2074.png',
        'BLUFFTON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2074.png',
        'Bluffton Beavers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2074.png',
        'Blugolds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2738.png',
        'Bndctn Col': 'https://a.espncdn.com/i/teamlogos/ncaa/500/16111.png',
        'Bobcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/455.png',
        'Boilermakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
        'BOIS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/68.png',
        'Boise St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/68.png',
        'Boise State Broncos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/68.png',
        'Boll Weevils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2028.png',
        'Bombers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/175.png',
        'Borregos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3100.png',
        'Boston College': 'https://a.espncdn.com/i/teamlogos/ncaa/500/103.png',
        'Boston College Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/103.png',
        'BOW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/340.png',
        'Bowdoin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/340.png',
        'Bowdoin Polar Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/340.png',
        'Bowie St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2075.png',
        'Bowie State Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2075.png',
        'Bowling Green': 'https://a.espncdn.com/i/teamlogos/ncaa/500/189.png',
        'Bowling Green Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/189.png',
        'Boxers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/205.png',
        'Braves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2882.png',
        'BRE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2913.png',
        'Brevard': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2913.png',
        'Brevard College Tornados': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2913.png',
        'Bridgewater (VA) Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2079.png',
        'Bridgewater St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/18.png',
        'Bridgewater State Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/18.png',
        'Bridgewater VA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2079.png',
        'British Col': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2080.png',
        'British Columbia British Col': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2080.png',
        'Britons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2790.png',
        'Britsh Col': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2080.png',
        'BRO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2781.png',
        'Brockport': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2781.png',
        'Brockport Golden Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2781.png',
        'Bronchos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2122.png',
        'Broncos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2711.png',
        'Brown': 'https://a.espncdn.com/i/teamlogos/ncaa/500/225.png',
        'Brown Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/225.png',
        'BRST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/18.png',
        'Bruins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/415.png',
        'BRVA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2079.png',
        'BRWN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/225.png',
        'BRY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2803.png',
        'Bryant': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2803.png',
        'Bryant Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2803.png',
        'BST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/132.png',
        'BSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2075.png',
        'Buccaneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110.png',
        'BUCK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2083.png',
        'Buckeyes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
        'Bucknell': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2083.png',
        'Bucknell Bison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2083.png',
        'BUENA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/63.png',
        'Buena Vista': 'https://a.espncdn.com/i/teamlogos/ncaa/500/63.png',
        'Buena Vista Beavers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/63.png',
        'BUF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2085.png',
        'Buffalo': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2084.png',
        'Buffalo Bulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2084.png',
        'Buffalo State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2085.png',
        'Buffalo State Bengals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2085.png',
        'Buffaloes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2704.png',
        'Builders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3111.png',
        'Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/351.png',
        'Bullets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2248.png',
        'Bulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2084.png',
        'BUT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2086.png',
        'Butler': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2086.png',
        'Butler Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2086.png',
        'BYU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png',
        'BYU Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png',
        'C Arkansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2110.png',
        'C Connecticut': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2115.png',
        'C Methodst': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2860.png',
        'C Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2117.png',
        'C Missouri': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2118.png',
        'C of Faith': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3211.png',
        'C of NJ': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2442.png',
        'C Okla': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2122.png',
        'C Wash': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2120.png',
        'Cadets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2467.png',
        'CAL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129738.png',
        'Cal Luthrn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2094.png',
        'Cal Poly': 'https://a.espncdn.com/i/teamlogos/ncaa/500/13.png',
        'Cal Poly Mustangs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/13.png',
        'California': 'https://a.espncdn.com/i/teamlogos/ncaa/500/25.png',
        'California Golden Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/25.png',
        'California Lutheran University Kingsmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2094.png',
        'CALLUTH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2094.png',
        'Calvin Univers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129738.png',
        'Calvin University Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129738.png',
        'CAM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2097.png',
        'Campbell': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2097.png',
        'Campbell Fighting Camels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2097.png',
        'Campbellsville University Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2098.png',
        'Camplville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2098.png',
        'Capital': 'https://a.espncdn.com/i/teamlogos/ncaa/500/424.png',
        'CAPITAL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/424.png',
        'Capital Comets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/424.png',
        'Captains': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3112.png',
        'CAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2105.png',
        'CARCWI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2106.png',
        'Cardinal': 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
        'Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2911.png',
        'CARK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2110.png',
        'Carleton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2101.png',
        'CARLETON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2101.png',
        'Carleton Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2101.png',
        'CARM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2102.png',
        'Carnegie Mellon Tartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2102.png',
        'Carng Mell': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2102.png',
        'Carroll University (WI) Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/32.png',
        'Carroll WI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/32.png',
        'Carson-Newman': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2105.png',
        'Carson-Newman College Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2105.png',
        'Carthage': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2106.png',
        'Carthage Firebirds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2106.png',
        'CAS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/293.png',
        'Case Western Reserve Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2963.png',
        'Case Wstrn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2963.png',
        'Castleton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/293.png',
        'Castleton Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/293.png',
        'CAT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2107.png',
        'Catamounts': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2717.png',
        'Catawba': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2107.png',
        'Catawba Indians': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2107.png',
        'CATH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2108.png',
        'Catholic': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2108.png',
        'Catholic Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2108.png',
        'Cavaliers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2682.png',
        'CCSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2115.png',
        'CCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png',
        'CDF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2860.png',
        'CEN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2119.png',
        'CENM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2118.png',
        'CENO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2122.png',
        'Centenary': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101442.png',
        'Centenary Gentlemen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101442.png',
        'Central': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2964.png',
        'Central Arkansas Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2110.png',
        'Central College Dutch': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2964.png',
        'Central Connecticut Blue Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2115.png',
        'Central Methodist Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2860.png',
        'Central Michigan Chippewas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2117.png',
        'Central Missouri Mules': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2118.png',
        'Central Oklahoma Bronchos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2122.png',
        'Central St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2119.png',
        'Central State (OH) Marauders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2119.png',
        'Central Washington Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2120.png',
        'Centre': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2121.png',
        'CENTRE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2121.png',
        'Centre College Kentucky Colonels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2121.png',
        'CHA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/411.png',
        'Chadron St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2123.png',
        'Chadron St Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2123.png',
        'CHADRONST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2123.png',
        'Chanticleers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png',
        'Chapman': 'https://a.espncdn.com/i/teamlogos/ncaa/500/411.png',
        'Chapman Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/411.png',
        'Chargers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2441.png',
        'Charl WV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2128.png',
        'Charleston So': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2127.png',
        'Charleston Southern Buccaneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2127.png',
        'Charlotte': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png',
        'Charlotte 49ers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png',
        'Charlotte Saints': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3253.png',
        'Chattanooga': 'https://a.espncdn.com/i/teamlogos/ncaa/500/236.png',
        'Chattanooga Mocs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/236.png',
        'CHI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/80.png',
        'Chicago': 'https://a.espncdn.com/i/teamlogos/ncaa/500/80.png',
        'Chicago Maroons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/80.png',
        'Chiefs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2416.png',
        'Chippewas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2117.png',
        'CHO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2804.png',
        'Chowan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2804.png',
        'Chowan Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2804.png',
        'CHR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3112.png',
        'Chris Nwpt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3112.png',
        'Christopher Newport Captains': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3112.png',
        'CHSO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2127.png',
        'CHWV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2128.png',
        'CIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png',
        'Cincinnati': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png',
        'Cincinnati Bearcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png',
        'CIT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2643.png',
        'CKGA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2805.png',
        'CLA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/17.png',
        'Claremont-M-S': 'https://a.espncdn.com/i/teamlogos/ncaa/500/17.png',
        'Claremont-Mudd-Scripps College Stags': 'https://a.espncdn.com/i/teamlogos/ncaa/500/17.png',
        'Clarion': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2134.png',
        'CLARION': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2134.png',
        'Clarion Golden Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2134.png',
        'Clark (GA)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2805.png',
        'Clark Atlanta Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2805.png',
        'CLEM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
        'Clemson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
        'Clemson Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
        'Clippers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/507.png',
        'CLT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png',
        'Cmbrlnd KY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/511.png',
        'Cmbrlnd TN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2161.png',
        'CMPBVIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2098.png',
        'CMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2117.png',
        'Cncrdia IL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2151.png',
        'Cncrdia MH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2152.png',
        'Cncrdia MI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2985.png',
        'Cncrdia NE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/507.png',
        'Cncrdia SP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3066.png',
        'Cncrdia WI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/409.png',
        'CNTCIA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2964.png',
        'CO St Pueb': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2570.png',
        'Coast Guard': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2557.png',
        'Coast Guard Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2557.png',
        'Coastal': 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png',
        'Coastal Carolina Chanticleers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png',
        'Cobbers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2152.png',
        'Coe': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2141.png',
        'COE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2141.png',
        'Coe College Kohawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2141.png',
        'COI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108382.png',
        'COL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2442.png',
        'Colby': 'https://a.espncdn.com/i/teamlogos/ncaa/500/33.png',
        'COLBY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/33.png',
        'Colby College White Mules': 'https://a.espncdn.com/i/teamlogos/ncaa/500/33.png',
        'Cole': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3210.png',
        'COLE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3210.png',
        'Cole College Jaguars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3210.png',
        'COLG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2142.png',
        'Colgate': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2142.png',
        'Colgate Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2142.png',
        'Coll. of Idaho': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108382.png',
        'COLLE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3253.png',
        'College of Idaho Yotes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108382.png',
        'College Of New Jersey Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2442.png',
        'COLO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png',
        'Colo Mesa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/11.png',
        'Colo Mines': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2146.png',
        'COLOMINES': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2146.png',
        'Colonels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/398.png',
        'Colonials': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2523.png',
        'Colorado': 'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png',
        'Colorado Buffaloes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png',
        'Colorado Mesa Mavericks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/11.png',
        'Colorado School Of Mines Orediggers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2146.png',
        'Colorado St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/36.png',
        'Colorado State Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/36.png',
        'COLU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/171.png',
        'Columbia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/171.png',
        'Columbia Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/171.png',
        'Comets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/354.png',
        'Commodores': 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png',
        'CON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3066.png',
        'CONCMI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2985.png',
        'CONCOIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2151.png',
        'CONCOMN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2152.png',
        'CONCONE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/507.png',
        'Concord': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2148.png',
        'Concord University Mountain Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2148.png',
        'Concordia Moorhead Cobbers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2152.png',
        'Concordia University Chicago Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2151.png',
        'Concordia University Nebraska Clippers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/507.png',
        'Concordia University St Paul Golden Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3066.png',
        'Concordia-Michigan Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2985.png',
        'Concordia-Wisconsin Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/409.png',
        'CONN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png',
        'Continentals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/348.png',
        'CONW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/409.png',
        'COR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/172.png',
        'Cornell': 'https://a.espncdn.com/i/teamlogos/ncaa/500/172.png',
        'Cornell Big Red': 'https://a.espncdn.com/i/teamlogos/ncaa/500/172.png',
        'Cornell College (IA) Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2155.png',
        'Cornellia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2155.png',
        'CORNELLIA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2155.png',
        'Cornhuskers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png',
        'Corsairs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/379.png',
        'Cortland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2782.png',
        'CORTLAND': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2782.png',
        'Cortland Red Dragons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2782.png',
        'Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        'Cowboys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2751.png',
        'Coyotes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/233.png',
        'CP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/13.png',
        'Crimson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108.png',
        'Crimson Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2291.png',
        'Crimson Storm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/200.png',
        'Crimson Tide': 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
        'Crown': 'https://a.espncdn.com/i/teamlogos/ncaa/500/509.png',
        'CROWN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/509.png',
        'Crown College Polars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/509.png',
        'Crusaders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3211.png',
        'CSR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2963.png',
        'CSTP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2570.png',
        'CSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/36.png',
        'CSU Pueblo Thunderwolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2570.png',
        'CULVE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/510.png',
        'Culver-Stockton College Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/510.png',
        'Culvr-Stck': 'https://a.espncdn.com/i/teamlogos/ncaa/500/510.png',
        'CUMB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/511.png',
        'Cumberland (KY) Indians': 'https://a.espncdn.com/i/teamlogos/ncaa/500/511.png',
        'Cumberland (TN) Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2161.png',
        'CUMBTN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2161.png',
        'CUR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/40.png',
        'Curry': 'https://a.espncdn.com/i/teamlogos/ncaa/500/40.png',
        'Curry College Colonels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/40.png',
        'CWAU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2120.png',
        'Cyclones': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
        'DAKOT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/512.png',
        'Dakota St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/512.png',
        'Dakota State University Trojans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/512.png',
        'Dakota Wes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/513.png',
        'Dakota Wesleyan Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/513.png',
        'DART': 'https://a.espncdn.com/i/teamlogos/ncaa/500/159.png',
        'Dartmouth': 'https://a.espncdn.com/i/teamlogos/ncaa/500/159.png',
        'Dartmouth Big Green': 'https://a.espncdn.com/i/teamlogos/ncaa/500/159.png',
        'DAV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2166.png',
        'Davidson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2166.png',
        'Davidson Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2166.png',
        'DAY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2168.png',
        'Dayton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2168.png',
        'Dayton Flyers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2168.png',
        'DEA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110438.png',
        'DEAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110438.png',
        'DEAN Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110438.png',
        'DEF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/190.png',
        'Defiance': 'https://a.espncdn.com/i/teamlogos/ncaa/500/190.png',
        'Defiance College Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/190.png',
        'DEL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/48.png',
        'Del State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2170.png',
        'Del Valley': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2808.png',
        'Delaware': 'https://a.espncdn.com/i/teamlogos/ncaa/500/48.png',
        'Delaware Blue Hens': 'https://a.espncdn.com/i/teamlogos/ncaa/500/48.png',
        'Delaware St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2169.png',
        'Delaware State Hornets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2169.png',
        'Delaware Valley Aggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2808.png',
        'Delta Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2400.png',
        'Delta State Statesmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2170.png',
        'DELTAST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2170.png',
        'Demon Deacons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png',
        'Demons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2466.png',
        'DEN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2171.png',
        'Denison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2171.png',
        'Denison University Big Red': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2171.png',
        'DEP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/83.png',
        'DePauw': 'https://a.espncdn.com/i/teamlogos/ncaa/500/83.png',
        'Depauw Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/83.png',
        'Des Moines Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2254.png',
        'Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2221.png',
        'DIC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/316.png',
        'Dickinson (PA) Red Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2175.png',
        'Dickinson State University Blue Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/316.png',
        'Dicknsn PA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2175.png',
        'Dicknsn St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/316.png',
        'Diplomats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2234.png',
        'Dragons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2355.png',
        'Drake': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2181.png',
        'Drake Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2181.png',
        'DRKE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2181.png',
        'DSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2169.png',
        'DUB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/49.png',
        'Dubuque': 'https://a.espncdn.com/i/teamlogos/ncaa/500/49.png',
        'Dubuque Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/49.png',
        'Ducks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
        'Duhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/263.png',
        'Duke': 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png',
        'DUKE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png',
        'Duke Blue Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png',
        'Dukes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png',
        'DUQ': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2184.png',
        'Duquesne': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2184.png',
        'Duquesne Dukes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2184.png',
        'Dutch': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2964.png',
        'DV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2808.png',
        'DWU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/513.png',
        'E Cen OK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2191.png',
        'E Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2197.png',
        'E Kentucky': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2198.png',
        'E Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2199.png',
        'E Oregon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2202.png',
        'E Strouds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2188.png',
        'E Texas A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2837.png',
        'E TX Bapt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2194.png',
        'E Washington': 'https://a.espncdn.com/i/teamlogos/ncaa/500/331.png',
        'Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2740.png',
        'EAS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127954.png',
        'East Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
        'East Carolina Pirates': 'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
        'East Central (OK) Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2191.png',
        'East Stroudsburg University Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2188.png',
        'East Tennessee State Buccaneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2193.png',
        'East Texas A&M Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2837.png',
        'East Texas Baptist University Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2194.png',
        'Eastern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127954.png',
        'Eastern Illinois Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2197.png',
        'Eastern Kentucky Colonels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2198.png',
        'Eastern Michigan Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2199.png',
        'Eastern New Mexico Greyhounds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2201.png',
        'Eastern NM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2201.png',
        'Eastern Oregon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2202.png',
        'Eastern University Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127954.png',
        'Eastern Washington Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/331.png',
        'EASTERNNM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2201.png',
        'ECC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3236.png',
        'ECU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
        'Ed Waters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2206.png',
        'EDI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2205.png',
        'Edinboro': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2205.png',
        'Edinboro University Fighting Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2205.png',
        'EDW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2206.png',
        'Edward Waters Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2206.png',
        'EIU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2197.png',
        'EKU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2198.png',
        'Elgin Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122775.png',
        'ELI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2207.png',
        'Eliz City': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2207.png',
        'Elizabeth City State Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2207.png',
        'ELM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/72.png',
        'Elmhurst': 'https://a.espncdn.com/i/teamlogos/ncaa/500/72.png',
        'Elmhurst Bluejays': 'https://a.espncdn.com/i/teamlogos/ncaa/500/72.png',
        'Elon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2210.png',
        'ELON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2210.png',
        'Elon Phoenix': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2210.png',
        'EMHEN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2213.png',
        'Emory & Henry': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2213.png',
        'Emory & Henry College Wasps': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2213.png',
        'EMP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2214.png',
        'Emporia St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2214.png',
        'Emporia State University Hornets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2214.png',
        'EMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2199.png',
        'END': 'https://a.espncdn.com/i/teamlogos/ncaa/500/452.png',
        'Endicott': 'https://a.espncdn.com/i/teamlogos/ncaa/500/452.png',
        'Endicott College Gulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/452.png',
        'Engineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2749.png',
        'EORE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2202.png',
        'Ephs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2731.png',
        'Erie': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3236.png',
        'Erie Kats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3236.png',
        'ERS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101784.png',
        'Erskine': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101784.png',
        'Erskine Flying Fleet': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101784.png',
        'ESTROUD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2188.png',
        'ETAM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2837.png',
        'ETSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2193.png',
        'EUR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101.png',
        'Eureka': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101.png',
        'Eureka College Red Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101.png',
        'EVA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2865.png',
        'Evangel': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2865.png',
        'Evangel University Crusaders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2865.png',
        'EWU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/331.png',
        'FAI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3211.png',
        'Fairmnt St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2986.png',
        'Fairmont State Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2986.png',
        'FAIRST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2986.png',
        'Faith NC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3253.png',
        'Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2723.png',
        'FAMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/50.png',
        'FAU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2226.png',
        'Faulkner': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2219.png',
        'FAULKNER': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2219.png',
        'Faulkner University Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2219.png',
        'FAY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2220.png',
        'Fayetteville State Broncos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2220.png',
        'Fayetvl St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2220.png',
        'FDU Florhm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2221.png',
        'FDU-Florham Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2221.png',
        'FDUFLOR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2221.png',
        'FER': 'https://a.espncdn.com/i/teamlogos/ncaa/500/366.png',
        'Ferris St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2222.png',
        'Ferris State Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2222.png',
        'Ferrum': 'https://a.espncdn.com/i/teamlogos/ncaa/500/366.png',
        'Ferrum Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/366.png',
        'Fightin\' Engineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/86.png',
        'Fightin\' Quakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2733.png',
        'Fighting Bees': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2591.png',
        'Fighting Camels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2097.png',
        'Fighting Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/155.png',
        'Fighting Illini': 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
        'Fighting Irish': 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        'Fighting Muskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/332.png',
        'Fighting Saints': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2595.png',
        'Fighting Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2748.png',
        'Findlay': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2224.png',
        'FINDLAY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2224.png',
        'Findlay Oilers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2224.png',
        'Firebirds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2106.png',
        'Fires': 'https://a.espncdn.com/i/teamlogos/ncaa/500/267.png',
        'Firestorm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108358.png',
        'FITCH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/114.png',
        'Fitchburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/114.png',
        'Fitchburg State Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/114.png',
        'FIU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2229.png',
        'FLA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
        'FLAMEMRL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125762.png',
        'Flames': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2335.png',
        'Florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
        'Florida A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/50.png',
        'Florida A&M Rattlers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/50.png',
        'Florida Atlantic Owls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2226.png',
        'Florida Gators': 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
        'Florida International Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2229.png',
        'Florida Memori': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125762.png',
        'Florida Memorial University Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125762.png',
        'Florida St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
        'Florida State Seminoles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
        'Flyers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2168.png',
        'Flying Dutchmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/388.png',
        'Flying Fleet': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101784.png',
        'FOR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2230.png',
        'Fordham': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2230.png',
        'Fordham Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2230.png',
        'Foresters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/262.png',
        'Fort Hays State Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2231.png',
        'Fort Lewis Skyhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2237.png',
        'Fort Valley': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2232.png',
        'Fort Valley State Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2232.png',
        'FORTLEW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2237.png',
        'FRA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2967.png',
        'Framingham St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2967.png',
        'Framingham State Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2967.png',
        'FRANK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112334.png',
        'Franklin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2233.png',
        'FRANKLIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2233.png',
        'Franklin & Marshall Diplomats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2234.png',
        'Franklin Grizzlies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2233.png',
        'Franklin Pierce Ravens': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112334.png',
        'FRES': 'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
        'Fresno St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
        'Fresno State Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
        'FRIE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/527.png',
        'Friends': 'https://a.espncdn.com/i/teamlogos/ncaa/500/527.png',
        'Friends University Friends': 'https://a.espncdn.com/i/teamlogos/ncaa/500/527.png',
        'Frkln Mrsh': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2234.png',
        'FRKLNMAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2234.png',
        'FRNKLNPRCE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112334.png',
        'FRO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/341.png',
        'Frostburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/341.png',
        'Frostburg State Bobcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/341.png',
        'FRST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2222.png',
        'FSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
        'Ft Hays St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2231.png',
        'Ft Lewis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2237.png',
        'FTHAYST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2231.png',
        'FUR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/231.png',
        'Furman': 'https://a.espncdn.com/i/teamlogos/ncaa/500/231.png',
        'Furman Paladins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/231.png',
        'FVSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2232.png',
        'G\'Town Col': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2245.png',
        'GA Southern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/290.png',
        'GAL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/417.png',
        'Gallaudet': 'https://a.espncdn.com/i/teamlogos/ncaa/500/417.png',
        'Gallaudet Bison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/417.png',
        'Gamecocks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
        'GAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/367.png',
        'Gannon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/367.png',
        'Gannon Golden Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/367.png',
        'Gardner-Webb': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2241.png',
        'Gardner-Webb Runnin\' Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2241.png',
        'Garnet Chargers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/237.png',
        'GASO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/290.png',
        'GAST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png',
        'Gators': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2018.png',
        'Generals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2688.png',
        'Geneva': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2242.png',
        'GENEVA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2242.png',
        'Geneva Golden Tornadoes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2242.png',
        'Gentlemen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101442.png',
        'George Fox': 'https://a.espncdn.com/i/teamlogos/ncaa/500/415.png',
        'George Mason': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2244.png',
        'George Mason University Patriots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2244.png',
        'Georgetown': 'https://a.espncdn.com/i/teamlogos/ncaa/500/46.png',
        'Georgetown College Kentucky Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2245.png',
        'Georgetown Hoyas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/46.png',
        'Georgia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
        'Georgia Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
        'Georgia Southern Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/290.png',
        'Georgia St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png',
        'Georgia State Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png',
        'Georgia Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png',
        'Georgia Tech Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png',
        'GETTY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2248.png',
        'Gettysburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2248.png',
        'Gettysburg Bullets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2248.png',
        'GFU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/415.png',
        'Giants': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122774.png',
        'Glenville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2249.png',
        'GLENVILLE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2249.png',
        'Glenville State Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2249.png',
        'Glory Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3254.png',
        'GMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2244.png',
        'Golden Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2702.png',
        'Golden Bulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2304.png',
        'Golden Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2128.png',
        'Golden Flashes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2309.png',
        'Golden Gophers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png',
        'Golden Gusties': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2968.png',
        'Golden Hurricane': 'https://a.espncdn.com/i/teamlogos/ncaa/500/202.png',
        'Golden Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/367.png',
        'Golden Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2029.png',
        'Golden Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/223.png',
        'Golden Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2657.png',
        'Golden Tornadoes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2242.png',
        'Golden Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111674.png',
        'Gorillas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/90.png',
        'Governors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2046.png',
        'Graceland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/530.png',
        'Graceland University Graceland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/530.png',
        'GRAM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2755.png',
        'Grambling': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2755.png',
        'Grambling Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2755.png',
        'Grand Vall': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125.png',
        'Grand Valley State University Lakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125.png',
        'Grand View': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2254.png',
        'GRANDVIEW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2254.png',
        'GRC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/530.png',
        'Great Danes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/399.png',
        'Green Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2832.png',
        'Green Terror': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2700.png',
        'Green Wave': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png',
        'Greeneville Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2839.png',
        'Greensboro': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2256.png',
        'Greensboro College Pride': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2256.png',
        'Greenville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2257.png',
        'Greenville Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2257.png',
        'Greyhounds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/323.png',
        'GRI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/65.png',
        'Griffins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/611.png',
        'Griffons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/137.png',
        'Grinnell': 'https://a.espncdn.com/i/teamlogos/ncaa/500/65.png',
        'Grinnell Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/65.png',
        'Grizzlies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/149.png',
        'GRNSBORO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2256.png',
        'GRNVIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2257.png',
        'GRO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/146.png',
        'Grove City': 'https://a.espncdn.com/i/teamlogos/ncaa/500/146.png',
        'Grove City College Wolverines': 'https://a.espncdn.com/i/teamlogos/ncaa/500/146.png',
        'GT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png',
        'GTOWNCOLL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2245.png',
        'GTWN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/46.png',
        'GUI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2258.png',
        'Guilford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2258.png',
        'Guilford College Quakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2258.png',
        'Gulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/452.png',
        'GUSADOL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2968.png',
        'Gustavus Adolphus Golden Gusties': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2968.png',
        'Gustvs Adl': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2968.png',
        'GVSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125.png',
        'GWEB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2241.png',
        'Gyrenes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3178.png',
        'HAM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/297.png',
        'Hamilton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/348.png',
        'Hamilton Continentals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/348.png',
        'Hamline': 'https://a.espncdn.com/i/teamlogos/ncaa/500/162.png',
        'Hamline University Pipers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/162.png',
        'HAMP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2261.png',
        'Hamp Sdney': 'https://a.espncdn.com/i/teamlogos/ncaa/500/297.png',
        'Hampden-Sydney Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/297.png',
        'Hampton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2261.png',
        'Hampton Pirates': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2261.png',
        'HAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2262.png',
        'Hanover': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2262.png',
        'Hanover College Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2262.png',
        'HAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/173.png',
        'Hardin-Simmons Cowboys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2810.png',
        'Harding': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2264.png',
        'HARDING': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2264.png',
        'Harding University Bisons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2264.png',
        'Hardn-Simm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2810.png',
        'Hardrockers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/613.png',
        'HARDSIM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2810.png',
        'Hartwick': 'https://a.espncdn.com/i/teamlogos/ncaa/500/173.png',
        'Hartwick Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/173.png',
        'HARV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108.png',
        'Harvard': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108.png',
        'Harvard Crimson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108.png',
        'Haskell': 'https://a.espncdn.com/i/teamlogos/ncaa/500/535.png',
        'HASKELL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/535.png',
        'Haskell Indian Nations Univ Jayhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/535.png',
        'Hatters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/56.png',
        'HAW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
        'Hawai\'i': 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
        'Hawai\'i Rainbow Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
        'Hawkeyes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
        'Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2830.png',
        'HBRT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/174.png',
        'HC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/107.png',
        'HCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2277.png',
        'HEI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/191.png',
        'Heidelberg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/191.png',
        'Heidelberg Student Princes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/191.png',
        'Henderson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2271.png',
        'HENDERSON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2271.png',
        'Henderson State Reddies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2271.png',
        'Hendrix': 'https://a.espncdn.com/i/teamlogos/ncaa/500/418.png',
        'HENDRIX': 'https://a.espncdn.com/i/teamlogos/ncaa/500/418.png',
        'Hendrix College Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/418.png',
        'HIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125974.png',
        'Hilbert College': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125974.png',
        'Hilbert College Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/125974.png',
        'Hillsdale': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2273.png',
        'HILLSDALE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2273.png',
        'Hillsdale Chargers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2273.png',
        'Hilltoppers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/98.png',
        'HIR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2274.png',
        'Hiram': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2274.png',
        'Hiram College Terriers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2274.png',
        'HNTNGDN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2938.png',
        'Hobart': 'https://a.espncdn.com/i/teamlogos/ncaa/500/174.png',
        'Hobart College Statesmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/174.png',
        'Hokies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
        'HOL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108354.png',
        'Holland College': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108354.png',
        'Holland College Hurricanes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108354.png',
        'Holy Cross': 'https://a.espncdn.com/i/teamlogos/ncaa/500/107.png',
        'Holy Cross Crusaders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/107.png',
        'Hoosiers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
        'HOP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2812.png',
        'Hope': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2812.png',
        'Hope College Flying Dutchmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2812.png',
        'Horned Frogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png',
        'Hornets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2828.png',
        'HOU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/248.png',
        'Hou Christian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2277.png',
        'Houston': 'https://a.espncdn.com/i/teamlogos/ncaa/500/248.png',
        'Houston Christian Huskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2277.png',
        'Houston Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/248.png',
        'HOW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/47.png',
        'Howard': 'https://a.espncdn.com/i/teamlogos/ncaa/500/47.png',
        'Howard Bison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/47.png',
        'Howard Payne Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2758.png',
        'HOWPAY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2758.png',
        'Hoyas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/46.png',
        'Hudson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3237.png',
        'Huntingdon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2938.png',
        'Huntingdon College (AL) Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2938.png',
        'Hurricanes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        'Huskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
        'Husson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2280.png',
        'HUSSON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2280.png',
        'Husson Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2280.png',
        'HVCC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3237.png',
        'Hwrd Payne': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2758.png',
        'Ichabods': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2687.png',
        'Idaho': 'https://a.espncdn.com/i/teamlogos/ncaa/500/70.png',
        'Idaho St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/304.png',
        'Idaho State Bengals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/304.png',
        'Idaho Vandals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/70.png',
        'IDHO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/70.png',
        'IDST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/304.png',
        'IL Weslyan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/306.png',
        'ILL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
        'Ill Col': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2286.png',
        'ILLCOLL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2286.png',
        'Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
        'Illinois College Blueboys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2286.png',
        'Illinois Fighting Illini': 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
        'Illinois St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2287.png',
        'Illinois State Redbirds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2287.png',
        'Illinois Wesleyan Titans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/306.png',
        'ILLWES': 'https://a.espncdn.com/i/teamlogos/ncaa/500/306.png',
        'ILST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2287.png',
        'Incarnate Word': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2916.png',
        'Incarnate Word Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2916.png',
        'Indiana': 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
        'Indiana Hoosiers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
        'Indiana PA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2291.png',
        'Indiana St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/282.png',
        'Indiana State Sycamores': 'https://a.espncdn.com/i/teamlogos/ncaa/500/282.png',
        'Indiana Wesleyan Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111756.png',
        'Indiana-Pennsylvania Crimson Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2291.png',
        'INDIANAPA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2291.png',
        'Indianapolis Greyhounds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2292.png',
        'Indians': 'https://a.espncdn.com/i/teamlogos/ncaa/500/511.png',
        'INDWESLYAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111756.png',
        'Indy': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2292.png',
        'INDY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2292.png',
        'INST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/282.png',
        'INWESL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111756.png',
        'Iowa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
        'IOWA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
        'Iowa Hawkeyes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
        'Iowa State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
        'Iowa State Cyclones': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
        'ISU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
        'ITH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/175.png',
        'Ithaca': 'https://a.espncdn.com/i/teamlogos/ncaa/500/175.png',
        'Ithaca College Bombers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/175.png',
        'IU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
        'Jackrabbits': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2571.png',
        'Jackson St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2296.png',
        'Jackson State Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2296.png',
        'Jacksonville State Gamecocks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png',
        'Jaguars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2582.png',
        'JAM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2939.png',
        'James Madison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png',
        'James Madison Dukes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png',
        'Jamestown': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2939.png',
        'Jamestown Jimmies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2939.png',
        'Javelinas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2658.png',
        'Jax State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png',
        'Jayhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
        'JHU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/118.png',
        'Jimmies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2939.png',
        'JKST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2296.png',
        'JMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png',
        'JOH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2304.png',
        'John Carrl': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2302.png',
        'John Carroll University Blue Streaks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2302.png',
        'Johnnies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2600.png',
        'Johns Hopkins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/118.png',
        'Johns Hopkins University Blue Jays': 'https://a.espncdn.com/i/teamlogos/ncaa/500/118.png',
        'Johnson C Smith Golden Bulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2304.png',
        'Jsn C Smth': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2304.png',
        'JUDSO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122775.png',
        'JUDSON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122775.png',
        'Jumbos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112.png',
        'JUN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/246.png',
        'Juniata': 'https://a.espncdn.com/i/teamlogos/ncaa/500/246.png',
        'Juniata College Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/246.png',
        'JXST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png',
        'KAL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126.png',
        'Kalamazoo': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126.png',
        'Kalamazoo Hornets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126.png',
        'KANSA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/547.png',
        'Kansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
        'Kansas Jayhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
        'Kansas St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
        'Kansas State Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
        'Kansas Wesleyan Ks Wesleyan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/547.png',
        'Kats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3236.png',
        'KCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3077.png',
        'Kean': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2871.png',
        'KEAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2871.png',
        'Kean Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2871.png',
        'Keiser': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126110.png',
        'KEISER': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126110.png',
        'Keiser Univers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126110.png',
        'Keiser University Keiser': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126110.png',
        'KEN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/352.png',
        'KENN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/338.png',
        'Kennesaw St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/338.png',
        'Kennesaw State Owls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/338.png',
        'KENT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2309.png',
        'Kent State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2309.png',
        'Kent State Golden Flashes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2309.png',
        'Kentucky': 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
        'Kentucky Christian Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3077.png',
        'Kentucky St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2310.png',
        'Kentucky State Thorobreds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2310.png',
        'Kentucky Wesleyan Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2316.png',
        'Kentucky Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
        'Kenyon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/352.png',
        'Kenyon Owls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/352.png',
        'KEY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122774.png',
        'Keydets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2678.png',
        'KIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/247.png',
        'King\'s College (PA) Monarchs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/247.png',
        'King\'s PA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/247.png',
        'Kingsmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2094.png',
        'Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2685.png',
        'KNO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/255.png',
        'Knox': 'https://a.espncdn.com/i/teamlogos/ncaa/500/255.png',
        'Knox College Prairie Fire': 'https://a.espncdn.com/i/teamlogos/ncaa/500/255.png',
        'Kohawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2141.png',
        'Ks Wesleyan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/547.png',
        'KS Weslyan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/547.png',
        'KSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
        'KU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
        'Kutztown': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2315.png',
        'KUTZTOWN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2315.png',
        'Kutztown University Golden Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2315.png',
        'KY Wesleyn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2316.png',
        'KYCHR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3077.png',
        'KYST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2310.png',
        'KYSTN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122774.png',
        'KYWESL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2316.png',
        'LA College': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2347.png',
        'LA PLUME Giants': 'https://a.espncdn.com/i/teamlogos/ncaa/500/122774.png',
        'La Verne Leopards': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2318.png',
        'LAC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2323.png',
        'LACOLLEGE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2347.png',
        'LAF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/322.png',
        'Lafayette': 'https://a.espncdn.com/i/teamlogos/ncaa/500/322.png',
        'Lafayette Leopards': 'https://a.espncdn.com/i/teamlogos/ncaa/500/322.png',
        'LAG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/548.png',
        'LaGrange': 'https://a.espncdn.com/i/teamlogos/ncaa/500/548.png',
        'Lagrange College Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/548.png',
        'LAK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/262.png',
        'Lake Erie': 'https://a.espncdn.com/i/teamlogos/ncaa/500/437.png',
        'Lake Erie Storm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/437.png',
        'Lake Forest College Foresters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/262.png',
        'Lake Forst': 'https://a.espncdn.com/i/teamlogos/ncaa/500/262.png',
        'LAKEERIE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/437.png',
        'LAKEL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6353.png',
        'Lakeland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6353.png',
        'LAKELAND Fires': 'https://a.espncdn.com/i/teamlogos/ncaa/500/267.png',
        'Lakeland Muskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6353.png',
        'Lakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127991.png',
        'LAM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2320.png',
        'Lamar': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2320.png',
        'Lamar Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2320.png',
        'Lancers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/402.png',
        'Lane': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2323.png',
        'Lane College Dragons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2323.png',
        'Langston': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2324.png',
        'LANGSTON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2324.png',
        'Langston University Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2324.png',
        'Laurinburg Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111610.png',
        'Laverne': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2318.png',
        'LAVERNE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2318.png',
        'LAW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/268.png',
        'Lawrence': 'https://a.espncdn.com/i/teamlogos/ncaa/500/268.png',
        'Lawrence University Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/268.png',
        'Leathernecks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2710.png',
        'LEB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/388.png',
        'Lebanon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/388.png',
        'Lebanon Valley Flying Dutchmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/388.png',
        'LEH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2329.png',
        'Lehigh': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2329.png',
        'Lehigh Mountain Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2329.png',
        'Len-Rhyne': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2331.png',
        'Lenoir-Rhyne Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2331.png',
        'LENRHYNE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2331.png',
        'Leopards': 'https://a.espncdn.com/i/teamlogos/ncaa/500/322.png',
        'LEW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2333.png',
        'Lewis & Clark College Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2333.png',
        'LHU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/209.png',
        'LIB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2335.png',
        'Liberty': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2335.png',
        'Liberty Flames': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2335.png',
        'LIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/203.png',
        'LINB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3209.png',
        'Lincoln (CA)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124179.png',
        'Lincoln (CA) Oaklanders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124179.png',
        'Lincoln (MO)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2876.png',
        'Lincoln (MO) Blue Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2876.png',
        'Lincoln (PA)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2339.png',
        'Lincoln (PA) Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2339.png',
        'Lind Bellv': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3209.png',
        'Lindenwood': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2815.png',
        'Lindenwood Belleville Lynx': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3209.png',
        'Lindenwood Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2815.png',
        'Lindsey': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2877.png',
        'Lindsey Wilson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2877.png',
        'Lindsey Wilson College Lindsey': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2877.png',
        'LINDWIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2877.png',
        'Linfield': 'https://a.espncdn.com/i/teamlogos/ncaa/500/203.png',
        'Linfield College Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/203.png',
        'LINP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2339.png',
        'Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3214.png',
        'Little Giants': 'https://a.espncdn.com/i/teamlogos/ncaa/500/89.png',
        'Little Rock Buffaloes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124386.png',
        'LIU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2341.png',
        'LIV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2940.png',
        'Livingstone Blue Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2940.png',
        'Lobos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2834.png',
        'Lock Haven': 'https://a.espncdn.com/i/teamlogos/ncaa/500/209.png',
        'Lock Haven University Bald Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/209.png',
        'Loggers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2508.png',
        'Long Island': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2341.png',
        'Long Island University Sharks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2341.png',
        'Longhorns': 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        'Lopers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2438.png',
        'LOR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/263.png',
        'Loras': 'https://a.espncdn.com/i/teamlogos/ncaa/500/263.png',
        'Loras College Duhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/263.png',
        'LOU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png',
        'Louisiana': 'https://a.espncdn.com/i/teamlogos/ncaa/500/309.png',
        'Louisiana College Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2347.png',
        'Louisiana Ragin\' Cajuns': 'https://a.espncdn.com/i/teamlogos/ncaa/500/309.png',
        'Louisiana Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2348.png',
        'Louisiana Tech Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2348.png',
        'Louisville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png',
        'Louisville Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png',
        'LSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
        'LSU Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
        'LT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2348.png',
        'Lumberjacks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2617.png',
        'LUT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/67.png',
        'Lutes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2486.png',
        'Luther': 'https://a.espncdn.com/i/teamlogos/ncaa/500/67.png',
        'Luther Norse': 'https://a.espncdn.com/i/teamlogos/ncaa/500/67.png',
        'Lvingstone': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2940.png',
        'Lws & Clrk': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2333.png',
        'Lycoming': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2354.png',
        'LYCOMING': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2354.png',
        'Lycoming Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2354.png',
        'Lynchburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2355.png',
        'Lynx': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2519.png',
        'LYON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101161.png',
        'LYONCOLL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101161.png',
        'LYONCOLL Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101161.png',
        'M-OH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/193.png',
        'MA Maritme': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110.png',
        'MACALES': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2359.png',
        'Macalester': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2359.png',
        'Macalester Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2359.png',
        'MADON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126146.png',
        'Madonna': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126146.png',
        'Madonna Univer': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126146.png',
        'Madonna University Madonna': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126146.png',
        'MAI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/274.png',
        'Maine': 'https://a.espncdn.com/i/teamlogos/ncaa/500/311.png',
        'Maine Black Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/311.png',
        'Maine Maritime Mariners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/274.png',
        'Majors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2398.png',
        'MAMARI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110.png',
        'Mammoths': 'https://a.espncdn.com/i/teamlogos/ncaa/500/7.png',
        'MAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2816.png',
        'Manchester': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2362.png',
        'Manchester Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2362.png',
        'Manitoba': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2770.png',
        'MANITOBA Manitoba': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2770.png',
        'Mansfield': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2365.png',
        'MANSFIELD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2365.png',
        'Mansfield University Mountaineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2365.png',
        'MAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/446.png',
        'Marauders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/559.png',
        'Marian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2366.png',
        'Marian College Marian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2366.png',
        'MARIANIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2366.png',
        'Marietta': 'https://a.espncdn.com/i/teamlogos/ncaa/500/317.png',
        'Marietta Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/317.png',
        'Mariners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2383.png',
        'Marist': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2368.png',
        'Marist Red Foxes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2368.png',
        'Maritme NY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2951.png',
        'Maroon Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/60.png',
        'Maroons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/80.png',
        'Mars Hill': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2369.png',
        'Mars Hill Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2369.png',
        'Marshall': 'https://a.espncdn.com/i/teamlogos/ncaa/500/276.png',
        'Marshall Thundering Herd': 'https://a.espncdn.com/i/teamlogos/ncaa/500/276.png',
        'Mart Lther': 'https://a.espncdn.com/i/teamlogos/ncaa/500/446.png',
        'Martin Luther Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/446.png',
        'MARY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/559.png',
        'Mary Hardin-Baylor Crusaders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2371.png',
        'Maryland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
        'Maryland Terrapins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
        'Maryville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2373.png',
        'Maryville College (TN) Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2373.png',
        'MAS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/379.png',
        'MASS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/113.png',
        'Mass Maritime Buccaneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110.png',
        'Massachusetts Minutemen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/113.png',
        'Mavericks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2364.png',
        'MAYVILLE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/561.png',
        'Mayville State Comets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/561.png',
        'Mayvlle St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/561.png',
        'MB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2880.png',
        'MCD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2700.png',
        'McDaniel': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2700.png',
        'McDaniel College Green Terror': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2700.png',
        'McKendree': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2816.png',
        'McKendree Bearcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2816.png',
        'MCM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/241.png',
        'McMurry': 'https://a.espncdn.com/i/teamlogos/ncaa/500/241.png',
        'McMurry War Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/241.png',
        'MCN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2377.png',
        'McNeese': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2377.png',
        'McNeese Cowboys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2377.png',
        'MD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
        'ME': 'https://a.espncdn.com/i/teamlogos/ncaa/500/311.png',
        'ME Mrtme': 'https://a.espncdn.com/i/teamlogos/ncaa/500/274.png',
        'Mean Green': 'https://a.espncdn.com/i/teamlogos/ncaa/500/249.png',
        'Mechanics': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3130.png',
        'MEM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/235.png',
        'Memphis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/235.png',
        'Memphis Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/235.png',
        'MER': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2383.png',
        'MERC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2385.png',
        'Mercer': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2382.png',
        'Mercer Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2382.png',
        'Merchant Marine Academy Mariners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2383.png',
        'Mercyhurst': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2385.png',
        'Mercyhurst Lakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2385.png',
        'Merrimack': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2771.png',
        'Merrimack Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2771.png',
        'MESA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/11.png',
        'Methodist': 'https://a.espncdn.com/i/teamlogos/ncaa/500/291.png',
        'Methodist Monarchs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/291.png',
        'Mexico': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3212.png',
        'Mexico U': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3212.png',
        'MH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2369.png',
        'MHLBRG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2422.png',
        'MIA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        'Miami': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        'Miami (OH) RedHawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/193.png',
        'Miami Hurricanes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        'Miami OH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/193.png',
        'MICH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
        'Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
        'Michigan St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
        'Michigan State Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
        'Michigan Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2392.png',
        'Michigan Tech Huskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2392.png',
        'Michigan Wolverines': 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
        'MID': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2395.png',
        'Mid Luthrn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/565.png',
        'Middle Tennessee Blue Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2393.png',
        'Middlebury': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2394.png',
        'Middlebury Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2394.png',
        'MIDLAND': 'https://a.espncdn.com/i/teamlogos/ncaa/500/565.png',
        'Midland Lutheran': 'https://a.espncdn.com/i/teamlogos/ncaa/500/565.png',
        'Midland Lutheran College Midland Lutheran': 'https://a.espncdn.com/i/teamlogos/ncaa/500/565.png',
        'MIDLBRY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2394.png',
        'Midshipmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png',
        'Midwest St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2395.png',
        'Midwestern State Mustangs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2395.png',
        'MIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2398.png',
        'Miles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2396.png',
        'Miles College Golden Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2396.png',
        'Millersville Marauders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/210.png',
        'Millersvll': 'https://a.espncdn.com/i/teamlogos/ncaa/500/210.png',
        'Millikin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/74.png',
        'Millikin Big Blue': 'https://a.espncdn.com/i/teamlogos/ncaa/500/74.png',
        'Millsaps': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2398.png',
        'Millsaps Majors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2398.png',
        'MIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/568.png',
        'Miners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2638.png',
        'MINN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png',
        'Minn Duluth': 'https://a.espncdn.com/i/teamlogos/ncaa/500/134.png',
        'Minnesota': 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png',
        'Minnesota Duluth Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/134.png',
        'Minnesota Golden Gophers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png',
        'Minnesota Morris Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2399.png',
        'Minnesota St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2364.png',
        'Minnesota State Mavericks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2364.png',
        'Minnesota State Moorhead Dragons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2817.png',
        'Minot St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/568.png',
        'Minot State Beavers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/568.png',
        'Minutemen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/113.png',
        'MIS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2402.png',
        'MISC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2969.png',
        'Misercord': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2969.png',
        'Misericordia Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2969.png',
        'MISS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        'Miss Valley St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2400.png',
        'Mississippi St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
        'Mississippi State Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
        'Mississippi Valley State Delta Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2400.png',
        'Missouri': 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
        'Missouri S&T Miners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2402.png',
        'Missouri Southern State Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2403.png',
        'Missouri St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2623.png',
        'Missouri State Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2623.png',
        'Missouri Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
        'Missouri Western Griffons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/137.png',
        'MIT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/109.png',
        'MIT Engineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/109.png',
        'MIZ': 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
        'MN Morris': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2399.png',
        'MNCHSTR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2362.png',
        'MNMOR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2399.png',
        'MNST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2364.png',
        'MO Baptist': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2880.png',
        'MO S&T': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2402.png',
        'MO Southrn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2403.png',
        'MO Westrn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/137.png',
        'Mocs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/236.png',
        'MON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3100.png',
        'Monarchs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
        'MONM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2405.png',
        'MONMIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2919.png',
        'Monmouth': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2405.png',
        'Monmouth (IL) Fighting Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2919.png',
        'Monmouth Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2405.png',
        'Monmth IL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2919.png',
        'MONT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/149.png',
        'Montana': 'https://a.espncdn.com/i/teamlogos/ncaa/500/149.png',
        'Montana Grizzlies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/149.png',
        'Montana St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/147.png',
        'Montana State Bobcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/147.png',
        'Montana West': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2701.png',
        'Montana-Western Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2701.png',
        'Montclair State Red Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2818.png',
        'Montclr St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2818.png',
        'Monterrey': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3100.png',
        'Monterrey Tech Borregos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3100.png',
        'Moorhead': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2817.png',
        'MOR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3110.png',
        'Moravian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/323.png',
        'Moravian Greyhounds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/323.png',
        'MORE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2413.png',
        'Morehead St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2413.png',
        'Morehead State Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2413.png',
        'Morehouse': 'https://a.espncdn.com/i/teamlogos/ncaa/500/60.png',
        'Morehouse College Maroon Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/60.png',
        'MORG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2415.png',
        'Morgan St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2415.png',
        'Morgan State Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2415.png',
        'Morningsde': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2416.png',
        'Morningside College Chiefs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2416.png',
        'Morrisvlle': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3110.png',
        'MOSSTC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2403.png',
        'MOST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2623.png',
        'Moundbuilders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/616.png',
        'Mount St. Joseph Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2419.png',
        'Mountain Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2329.png',
        'Mountain Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2148.png',
        'Mountaineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2714.png',
        'MOW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/137.png',
        'Mrchnt Mar': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2383.png',
        'MRMK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2771.png',
        'MRSH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/276.png',
        'MRST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2368.png',
        'Mry Hr-Bay': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2371.png',
        'MRYHRBAY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2371.png',
        'MRYVILTN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2373.png',
        'MSIDE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2416.png',
        'MSST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
        'MSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
        'Mt St Joe': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2419.png',
        'Mt Union': 'https://a.espncdn.com/i/teamlogos/ncaa/500/426.png',
        'MTH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/291.png',
        'MTS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2419.png',
        'MTST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/147.png',
        'MTSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2393.png',
        'MTU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/426.png',
        'MTWST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2701.png',
        'Muhlenberg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2422.png',
        'Muhlenberg Mules': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2422.png',
        'Muleriders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2568.png',
        'Mules': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2422.png',
        'MUR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/93.png',
        'Murray St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/93.png',
        'Murray State Racers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/93.png',
        'MUS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/332.png',
        'Muskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6353.png',
        'Muskingum': 'https://a.espncdn.com/i/teamlogos/ncaa/500/332.png',
        'Muskingum University Fighting Muskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/332.png',
        'Mustangs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2703.png',
        'MVSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2400.png',
        'N Arizona': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2464.png',
        'N Central': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3071.png',
        'N Colorado': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2458.png',
        'N Dakota St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2449.png',
        'N Greenvll': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2822.png',
        'N Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2459.png',
        'N Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/128.png',
        'N\'Western St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2466.png',
        'NAMERICAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/123086.png',
        'NAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2886.png',
        'NAU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2464.png',
        'Navy': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png',
        'NAVY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png',
        'Navy Midshipmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png',
        'NBY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2444.png',
        'NC A&T': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2448.png',
        'NC Central': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2428.png',
        'NC Pembrke': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2882.png',
        'NC State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png',
        'NC State Wolfpack': 'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png',
        'NC Wesleyn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/286.png',
        'NCAT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2448.png',
        'NCC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3071.png',
        'NCCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2428.png',
        'NCSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png',
        'ND': 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        'NDSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2449.png',
        'NE ST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/196.png',
        'NEB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png',
        'Neb Kearney': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2438.png',
        'Neb Wesleyan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6845.png',
        'Nebraska': 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png',
        'Nebraska Cornhuskers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png',
        'Nebraska Wesleyan Prairie Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6845.png',
        'Nebraska-Kearney Lopers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2438.png',
        'NEBWS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6845.png',
        'NEKR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2438.png',
        'NEL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2904.png',
        'Nelson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2904.png',
        'Nelson University Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2904.png',
        'NEV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
        'Nevada': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
        'Nevada Wolf Pack': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
        'New Hampshire': 'https://a.espncdn.com/i/teamlogos/ncaa/500/160.png',
        'New Hampshire Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/160.png',
        'New Haven': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2441.png',
        'New Haven Chargers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2441.png',
        'New Mexico': 'https://a.espncdn.com/i/teamlogos/ncaa/500/167.png',
        'New Mexico Highlands Cowboys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2424.png',
        'New Mexico Lobos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/167.png',
        'New Mexico St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/166.png',
        'New Mexico State Aggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/166.png',
        'NEWBERG Bruins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/415.png',
        'Newberry': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2444.png',
        'Newberry Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2444.png',
        'NEWENGLAND': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111675.png',
        'NG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2822.png',
        'NHVN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2441.png',
        'NICH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2447.png',
        'Nichls Col': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2884.png',
        'Nicholls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2447.png',
        'Nicholls Colonels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2447.png',
        'NICHOLS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2884.png',
        'Nichols College Bison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2884.png',
        'Nittany Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        'NIU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2459.png',
        'NM Highlnd': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2424.png',
        'NMH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2424.png',
        'NMI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/128.png',
        'NMSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/166.png',
        'NOR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2882.png',
        'Nor\'easters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111675.png',
        'NORF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2450.png',
        'Norfolk St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2450.png',
        'Norfolk State Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2450.png',
        'Norse': 'https://a.espncdn.com/i/teamlogos/ncaa/500/67.png',
        'NORTH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/286.png',
        'North Alabama': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2453.png',
        'North Alabama Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2453.png',
        'North American': 'https://a.espncdn.com/i/teamlogos/ncaa/500/123086.png',
        'North American University Stallions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/123086.png',
        'North Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
        'North Carolina A&T Aggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2448.png',
        'North Carolina Central Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2428.png',
        'North Carolina Tar Heels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
        'North Carolina Wesleyan Battling Bishops': 'https://a.espncdn.com/i/teamlogos/ncaa/500/286.png',
        'North Central College Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3071.png',
        'North Dakota': 'https://a.espncdn.com/i/teamlogos/ncaa/500/155.png',
        'North Dakota Fighting Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/155.png',
        'North Dakota State Bison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2449.png',
        'North Greenville Crusaders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2822.png',
        'North Park': 'https://a.espncdn.com/i/teamlogos/ncaa/500/75.png',
        'North Park Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/75.png',
        'North Texas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/249.png',
        'North Texas Mean Green': 'https://a.espncdn.com/i/teamlogos/ncaa/500/249.png',
        'Northeastern State RiverHawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/196.png',
        'Northern Arizona Lumberjacks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2464.png',
        'Northern Colorado Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2458.png',
        'Northern Illinois Huskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2459.png',
        'Northern Iowa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2460.png',
        'Northern Iowa Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2460.png',
        'Northern Michigan Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/128.png',
        'Northern State Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/425.png',
        'Northrn St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/425.png',
        'Northwest Missouri St Bearcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/138.png',
        'Northwestern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/77.png',
        'Northwestern (MN) Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/583.png',
        'Northwestern Oklahoma State Rangers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2823.png',
        'Northwestern State Demons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2466.png',
        'Northwestern Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/77.png',
        'Northwood': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2886.png',
        'Northwood (MI) Timberwolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2886.png',
        'Norwich': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2467.png',
        'Norwich Cadets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2467.png',
        'Notre Dame': 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        'Notre Dame Fighting Irish': 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        'NU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/77.png',
        'NW Coll MN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/583.png',
        'NW MO ST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/138.png',
        'NW OK ST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2823.png',
        'NWENG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111675.png',
        'NWMN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/583.png',
        'NWMS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/138.png',
        'NWO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2823.png',
        'NWST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2466.png',
        'Oaklanders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/124179.png',
        'OB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/319.png',
        'Oberlin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/391.png',
        'OBERLIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/391.png',
        'Oberlin Yeomen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/391.png',
        'ODU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
        'Ohio': 'https://a.espncdn.com/i/teamlogos/ncaa/500/195.png',
        'OHIO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/195.png',
        'Ohio Bobcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/195.png',
        'Ohio Nor': 'https://a.espncdn.com/i/teamlogos/ncaa/500/427.png',
        'Ohio Northern Polar Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/427.png',
        'Ohio State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
        'Ohio State Buckeyes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
        'Ohio State Newark Titans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3161.png',
        'Ohio Wesleyan Battling Bishops': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2980.png',
        'Ohioweslyn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2980.png',
        'OHNRTH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/427.png',
        'OHWESL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2980.png',
        'Oilers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2224.png',
        'Ok Panhandle St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2824.png',
        'Okbaptu': 'https://a.espncdn.com/i/teamlogos/ncaa/500/319.png',
        'OKLAH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2824.png',
        'Oklahoma': 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
        'Oklahoma Baptist Bison': 'https://a.espncdn.com/i/teamlogos/ncaa/500/319.png',
        'Oklahoma Panhandle St Ok Panhandle St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2824.png',
        'Oklahoma Sooners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
        'Oklahoma St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
        'Oklahoma State Cowboys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
        'Okpanhndle': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2824.png',
        'OKST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
        'Old Dominion': 'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
        'Old Dominion Monarchs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
        'Ole Miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        'Ole Miss Rebels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        'Oles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/133.png',
        'Olivet': 'https://a.espncdn.com/i/teamlogos/ncaa/500/354.png',
        'Olivet Comets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/354.png',
        'Orange': 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
        'ORE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
        'Orediggers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2146.png',
        'Oregon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
        'Oregon Ducks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
        'Oregon St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        'Oregon State Beavers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        'ORST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        'OSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3161.png',
        'Osunewark': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3161.png',
        'OTT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/359.png',
        'Otterbein': 'https://a.espncdn.com/i/teamlogos/ncaa/500/359.png',
        'Otterbein Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/359.png',
        'OU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
        'OUA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2888.png',
        'Ouachita': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2888.png',
        'Ouachita Baptist Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2888.png',
        'Owls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2909.png',
        'PAC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/205.png',
        'Pace': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2487.png',
        'Pace Setters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2487.png',
        'Pacific (OR) Boxers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/205.png',
        'Pacific Lutheran Lutes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2486.png',
        'Pacificor': 'https://a.espncdn.com/i/teamlogos/ncaa/500/205.png',
        'PACLTH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2486.png',
        'Pacluthern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2486.png',
        'Paladins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/231.png',
        'Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2676.png',
        'Patriots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2244.png',
        'Peacocks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/389.png',
        'Penguins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2754.png',
        'Penn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/219.png',
        'PENN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/219.png',
        'Penn State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        'Penn State Nittany Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        'Pennsylvania Quakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/219.png',
        'PennWest Cal': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2858.png',
        'PennWest California Vulcans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2858.png',
        'Pensacola Argonauts': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110242.png',
        'Phoenix': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2210.png',
        'Phoenix Firestorm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108358.png',
        'PIKEV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/95.png',
        'Pikeville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/95.png',
        'Pikeville Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/95.png',
        'Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/272.png',
        'Pipers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/162.png',
        'Pirates': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2721.png',
        'PIT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/90.png',
        'Pitt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
        'PITT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
        'Pitt St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/90.png',
        'Pittsburg St Gorillas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/90.png',
        'Pittsburgh Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
        'Plymouth State Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2972.png',
        'Plymouthst': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2972.png',
        'PLYST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2972.png',
        'Point': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3179.png',
        'POINT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3179.png',
        'Point University Skyhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3179.png',
        'Pointers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2743.png',
        'Polar Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/427.png',
        'Polars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/509.png',
        'POM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2923.png',
        'Pomona Pitzer Sagehens': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2923.png',
        'Pomonapit': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2923.png',
        'Portland St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2502.png',
        'Portland State Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2502.png',
        'POS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126086.png',
        'Post Universit': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126086.png',
        'Post University Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/126086.png',
        'Prairie Fire': 'https://a.espncdn.com/i/teamlogos/ncaa/500/255.png',
        'Prairie View': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2504.png',
        'Prairie View A&M Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2504.png',
        'Prairie Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6845.png',
        'PRES': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2506.png',
        'Presbyterian': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2506.png',
        'Presbyterian Blue Hose': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2506.png',
        'Presidents': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2686.png',
        'Pride': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2725.png',
        'PRIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/163.png',
        'Princeton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/163.png',
        'Princeton Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/163.png',
        'Privateers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2951.png',
        'Profs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2827.png',
        'PRST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2502.png',
        'PSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        'PUGET': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2508.png',
        'Puget Sound Loggers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2508.png',
        'Pugetsound': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2508.png',
        'PUR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
        'Purdue': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
        'Purdue Boilermakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
        'PV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2504.png',
        'PWC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2858.png',
        'Quakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/219.png',
        'QUI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2825.png',
        'Quincy': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2825.png',
        'Quincy Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2825.png',
        'Racers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/93.png',
        'Ragin\' Cajuns': 'https://a.espncdn.com/i/teamlogos/ncaa/500/309.png',
        'Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/426.png',
        'Rainbow Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
        'Ramblin\' Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/495.png',
        'Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2736.png',
        'RAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2516.png',
        'Randmacon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2516.png',
        'Randolph-Macon Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2516.png',
        'Rangers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2823.png',
        'Rattlers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/50.png',
        'Ravens': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112334.png',
        'Razorbacks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
        'Reading Golden Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111674.png',
        'Rebels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2439.png',
        'RED': 'https://a.espncdn.com/i/teamlogos/ncaa/500/29.png',
        'Red Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/101.png',
        'Red Dragons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2782.png',
        'Red Flash': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2598.png',
        'Red Foxes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2368.png',
        'Red Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2891.png',
        'Red Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
        'Red Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
        'Redbirds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2287.png',
        'Reddies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2271.png',
        'Redhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2546.png',
        'RedHawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/193.png',
        'Redlands': 'https://a.espncdn.com/i/teamlogos/ncaa/500/29.png',
        'Redlands Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/29.png',
        'Regents': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2524.png',
        'REIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2890.png',
        'Reinhardt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2890.png',
        'Reinhardt University Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2890.png',
        'Rensselaer': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2528.png',
        'Rensselaer Engineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2528.png',
        'RHO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2519.png',
        'Rhode Island': 'https://a.espncdn.com/i/teamlogos/ncaa/500/227.png',
        'Rhode Island Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/227.png',
        'Rhodes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2519.png',
        'Rhodes College Lynx': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2519.png',
        'Rice': 'https://a.espncdn.com/i/teamlogos/ncaa/500/242.png',
        'RICE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/242.png',
        'Rice Owls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/242.png',
        'RICH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/257.png',
        'Richmond': 'https://a.espncdn.com/i/teamlogos/ncaa/500/257.png',
        'Richmond Spiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/257.png',
        'RIP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2891.png',
        'Ripon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2891.png',
        'Ripon Red Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2891.png',
        'River Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/216.png',
        'RiverHawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/196.png',
        'RMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2523.png',
        'Roadrunners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2636.png',
        'Rob Mor IL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/599.png',
        'Robert Morris': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2523.png',
        'Robert Morris Colonials': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2523.png',
        'Robert Morris University-Illinois Lakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/599.png',
        'ROC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/184.png',
        'Rochester': 'https://a.espncdn.com/i/teamlogos/ncaa/500/184.png',
        'Rockets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2649.png',
        'ROCKF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2524.png',
        'Rockford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2524.png',
        'Rockford Regents': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2524.png',
        'ROO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127991.png',
        'ROOSE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/599.png',
        'Roosevelt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127991.png',
        'Roosevelt Lakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127991.png',
        'Rose-Hulman Fightin\' Engineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/86.png',
        'ROSEHUL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/86.png',
        'Rosehulman': 'https://a.espncdn.com/i/teamlogos/ncaa/500/86.png',
        'ROW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2827.png',
        'Rowan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2827.png',
        'Rowan Profs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2827.png',
        'Royals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2683.png',
        'RPI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2528.png',
        'Runnin\' Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2241.png',
        'RUTG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
        'Rutgers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
        'Rutgers Scarlet Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
        'S Ark': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2568.png',
        'S Conn St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2583.png',
        'S Dakota St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2571.png',
        'S Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/79.png',
        'S Nazarene': 'https://a.espncdn.com/i/teamlogos/ncaa/500/200.png',
        'S Oregon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2584.png',
        'S Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2896.png',
        'SAC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/16.png',
        'Sacramento St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/16.png',
        'Sacramento State Hornets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/16.png',
        'Sacred Heart': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2529.png',
        'Sacred Heart Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2529.png',
        'Sagehens': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2923.png',
        'SAGI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129.png',
        'Saginaw Valley State Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129.png',
        'Saginawval': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129.png',
        'Saint Francis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2598.png',
        'Saint Francis Red Flash': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2598.png',
        'Saint John\'s (MN) Johnnies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2600.png',
        'Saint Vincent': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2614.png',
        'Saint Vincent Bearcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2614.png',
        'Saints': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2646.png',
        'SALIS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2532.png',
        'Salisbury': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2532.png',
        'Salisbury Sea Gulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2532.png',
        'Salukis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/79.png',
        'SALVE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2776.png',
        'Salve Regina Seahawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2776.png',
        'Salvregina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2776.png',
        'SAM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2535.png',
        'Sam Houston': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2534.png',
        'Sam Houston Bearkats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2534.png',
        'Samford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2535.png',
        'Samford Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2535.png',
        'San Diego': 'https://a.espncdn.com/i/teamlogos/ncaa/500/301.png',
        'San Diego St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
        'San Diego State Aztecs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
        'San Diego Toreros': 'https://a.espncdn.com/i/teamlogos/ncaa/500/301.png',
        'San José St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
        'San José State Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
        'SAV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2542.png',
        'Savage Storm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/199.png',
        'Savannah St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2542.png',
        'Savannah State Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2542.png',
        'Saxons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/365.png',
        'SBP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2831.png',
        'SC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
        'SC State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2569.png',
        'Scarlet Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
        'SCHOLA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/375.png',
        'Scholastic': 'https://a.espncdn.com/i/teamlogos/ncaa/500/375.png',
        'SCKS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/616.png',
        'Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2373.png',
        'SCST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2569.png',
        'SD Mines': 'https://a.espncdn.com/i/teamlogos/ncaa/500/613.png',
        'SDAK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/233.png',
        'SDMT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/613.png',
        'SDST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2571.png',
        'SDSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
        'SE Louisiana': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2545.png',
        'SE Louisiana Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2545.png',
        'SE Missouri': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2546.png',
        'SE OK ST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/199.png',
        'Sea Gulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2532.png',
        'Seahawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2681.png',
        'Seawolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2619.png',
        'SELA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2545.png',
        'Seminoles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
        'SEMO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2546.png',
        'SEOS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/199.png',
        'Seton Hill': 'https://a.espncdn.com/i/teamlogos/ncaa/500/611.png',
        'Seton Hill Griffins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/611.png',
        'SETONHILL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/611.png',
        'Setters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2487.png',
        'SEU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/267.png',
        'SEWAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2553.png',
        'Sewanee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2553.png',
        'Sewanee Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2553.png',
        'SF Austin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2617.png',
        'SFA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2617.png',
        'SFIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2595.png',
        'SFPA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2598.png',
        'SH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2562.png',
        'Sharks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2341.png',
        'Shaw': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2551.png',
        'SHAW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2551.png',
        'Shaw Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2551.png',
        'SHE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2974.png',
        'SHENAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2828.png',
        'Shenandoah': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2828.png',
        'Shenandoah Hornets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2828.png',
        'Shepherd': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2974.png',
        'Shepherd Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2974.png',
        'Shipnsburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2559.png',
        'Shippensburg Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2559.png',
        'SHOR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2560.png',
        'Shorter': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2560.png',
        'Shorter Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2560.png',
        'SHPSBRG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2559.png',
        'SHSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2534.png',
        'SHU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2529.png',
        'Sieheights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2562.png',
        'SIMPS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2564.png',
        'Simpson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2564.png',
        'Simpson College (IA) Storm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2564.png',
        'Simpson University (Ca)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129758.png',
        'Simpson University (Ca) Simpuca': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129758.png',
        'Simpuca': 'https://a.espncdn.com/i/teamlogos/ncaa/500/129758.png',
        'SIO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2894.png',
        'Sioux Falls Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2894.png',
        'Siouxfalls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2894.png',
        'SIU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/79.png',
        'SJFISH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/374.png',
        'SJSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
        'Skyhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2630.png',
        'Slippery Rock The Rock': 'https://a.espncdn.com/i/teamlogos/ncaa/500/215.png',
        'Sliprock': 'https://a.espncdn.com/i/teamlogos/ncaa/500/215.png',
        'SMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png',
        'SMU Mustangs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png',
        'Sooners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
        'SOU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2584.png',
        'South Alabama': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6.png',
        'South Alabama Jaguars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6.png',
        'South Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
        'South Carolina Gamecocks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
        'South Carolina State Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2569.png',
        'South Dakota': 'https://a.espncdn.com/i/teamlogos/ncaa/500/233.png',
        'South Dakota Coyotes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/233.png',
        'South Dakota Mines Hardrockers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/613.png',
        'South Dakota State Jackrabbits': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2571.png',
        'South Florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
        'South Florida Bulls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
        'Southeast Missouri State Redhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2546.png',
        'Southeastern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/267.png',
        'Southeastern Oklahoma State Savage Storm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/199.png',
        'Southern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2582.png',
        'Southern Arkansas Muleriders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2568.png',
        'Southern Connecticut State Owls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2583.png',
        'Southern Illinois Salukis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/79.png',
        'Southern Jaguars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2582.png',
        'Southern Miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png',
        'Southern Miss Golden Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png',
        'Southern Nazarene Crimson Storm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/200.png',
        'Southern Oregon Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2584.png',
        'Southern Utah': 'https://a.espncdn.com/i/teamlogos/ncaa/500/253.png',
        'Southern Utah Thunderbirds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/253.png',
        'Southern Virginia Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2896.png',
        'Southwest Baptist Bearcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2586.png',
        'Southwest Minnesota State Mustangs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2587.png',
        'Southwestern College Moundbuilders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/616.png',
        'Southwestern Oklahoma State Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2927.png',
        'Southwestern University Pirates': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2588.png',
        'Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2880.png',
        'Spiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/257.png',
        'SPR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/81.png',
        'Springfield Pride': 'https://a.espncdn.com/i/teamlogos/ncaa/500/81.png',
        'Springfld': 'https://a.espncdn.com/i/teamlogos/ncaa/500/81.png',
        'SROS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2834.png',
        'SRU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/215.png',
        'St Ambrose': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2591.png',
        'St Ambrose University  Iowa Fighting Bees': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2591.png',
        'St Anselm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2830.png',
        'St Fran IL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2595.png',
        'St Fran IN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2831.png',
        'St Francis Illinois Fighting Saints': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2595.png',
        'St John Fisher': 'https://a.espncdn.com/i/teamlogos/ncaa/500/374.png',
        'St John Fisher University Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/374.png',
        'St John\'s (MN)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2600.png',
        'St Lawrence': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2779.png',
        'St Norbert': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2832.png',
        'St Thomas (MN)': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2900.png',
        'St Xavr IL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2615.png',
        'ST. A': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111610.png',
        'St. Andrew': 'https://a.espncdn.com/i/teamlogos/ncaa/500/111610.png',
        'St. Anselm Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2830.png',
        'ST. J': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2600.png',
        'St. Lawrence Saints': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2779.png',
        'St. Louis Spartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2880.png',
        'St. Norbert Green Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2832.png',
        'St. Olaf': 'https://a.espncdn.com/i/teamlogos/ncaa/500/133.png',
        'St. Olaf Oles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/133.png',
        'St. Petersburg Glory Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3254.png',
        'St. Scholastica Saints': 'https://a.espncdn.com/i/teamlogos/ncaa/500/375.png',
        'St. Thomas-Minnesota Tommies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2900.png',
        'St. Xavier IL Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2615.png',
        'STA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2830.png',
        'Stags': 'https://a.espncdn.com/i/teamlogos/ncaa/500/17.png',
        'Stallions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/123086.png',
        'STAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
        'Stanford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
        'Stanford Cardinal': 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
        'Statesmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2912.png',
        'STBK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2619.png',
        'STCKS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/618.png',
        'Steers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2637.png',
        'Stephen F. Austin Lumberjacks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2617.png',
        'Sterling': 'https://a.espncdn.com/i/teamlogos/ncaa/500/618.png',
        'Sterling College Sterling Ks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/618.png',
        'Sterling Ks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/618.png',
        'STET': 'https://a.espncdn.com/i/teamlogos/ncaa/500/56.png',
        'Stetson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/56.png',
        'Stetson Hatters': 'https://a.espncdn.com/i/teamlogos/ncaa/500/56.png',
        'Stevenson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/471.png',
        'Stevenson Mustangs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/471.png',
        'STMN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2900.png',
        'STN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2832.png',
        'STO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/284.png',
        'Stonehill': 'https://a.espncdn.com/i/teamlogos/ncaa/500/284.png',
        'Stonehill Skyhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/284.png',
        'Stony Brook': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2619.png',
        'Stony Brook Seawolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2619.png',
        'Storm': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2564.png',
        'STU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/471.png',
        'Student Princes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/191.png',
        'STV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2614.png',
        'STX': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2615.png',
        'Sul Ross State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2834.png',
        'Sul Ross State Lobos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2834.png',
        'Sun Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'SUNY Maritime Privateers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2951.png',
        'SUNY Morrisville Mustangs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3110.png',
        'SUNYMAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2951.png',
        'SUS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/216.png',
        'Susquehanna River Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/216.png',
        'Susquehnna': 'https://a.espncdn.com/i/teamlogos/ncaa/500/216.png',
        'SUU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/253.png',
        'SVA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2896.png',
        'SW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2588.png',
        'SW Baptist': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2586.png',
        'SW Coll': 'https://a.espncdn.com/i/teamlogos/ncaa/500/616.png',
        'SW Minn State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2587.png',
        'SW Okla St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2927.png',
        'SW Univ': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2588.png',
        'SWB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2586.png',
        'SWMN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2587.png',
        'SWO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2927.png',
        'Sycamores': 'https://a.espncdn.com/i/teamlogos/ncaa/500/282.png',
        'SYR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
        'Syracuse': 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
        'Syracuse Orange': 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
        'TA&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        'TAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2627.png',
        'Tar Heels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
        'Tarleton St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2627.png',
        'Tarleton State Texans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2627.png',
        'Tartans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2102.png',
        'Taylor': 'https://a.espncdn.com/i/teamlogos/ncaa/500/620.png',
        'TAYLOR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/620.png',
        'Taylor Trojans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/620.png',
        'TCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png',
        'TCU Horned Frogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png',
        'TEM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/218.png',
        'Temple': 'https://a.espncdn.com/i/teamlogos/ncaa/500/218.png',
        'Temple Owls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/218.png',
        'TENN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
        'Tennessee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
        'Tennessee St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2634.png',
        'Tennessee State Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2634.png',
        'Tennessee Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2635.png',
        'Tennessee Tech Golden Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2635.png',
        'Tennessee Volunteers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
        'Terrapins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
        'Terriers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2747.png',
        'TEX': 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        'Texans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2627.png',
        'Texas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        'Texas A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        'Texas A&M Aggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        'Texas A&M-Kingsville Javelinas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2658.png',
        'Texas Col': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2637.png',
        'Texas College Steers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2637.png',
        'Texas Longhorns': 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        'Texas Lutheran': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2639.png',
        'Texas Lutheran Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2639.png',
        'Texas Southern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2640.png',
        'Texas Southern Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2640.png',
        'Texas St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/326.png',
        'Texas State Bobcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/326.png',
        'Texas Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
        'Texas Tech Red Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
        'The Citadel': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2643.png',
        'The Citadel Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2643.png',
        'The Rock': 'https://a.espncdn.com/i/teamlogos/ncaa/500/215.png',
        'Thiel': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2644.png',
        'THIEL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2644.png',
        'Thiel Tomcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2644.png',
        'Thmas More': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2646.png',
        'THMORE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2646.png',
        'Thomas More College Saints': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2646.png',
        'Thorobreds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2310.png',
        'Thunder': 'https://a.espncdn.com/i/teamlogos/ncaa/500/396.png',
        'Thunderbirds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/253.png',
        'Thundering Herd': 'https://a.espncdn.com/i/teamlogos/ncaa/500/276.png',
        'Thunderwolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2570.png',
        'TIF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2838.png',
        'Tiffin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2838.png',
        'Tiffin Dragons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2838.png',
        'Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2746.png',
        'Timberwolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2886.png',
        'Titans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/271.png',
        'TL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2639.png',
        'TLSA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/202.png',
        'TNST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2634.png',
        'TNTC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2635.png',
        'TOL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2649.png',
        'Toledo': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2649.png',
        'Toledo Rockets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2649.png',
        'Tomcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2644.png',
        'Tommies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2900.png',
        'Toreros': 'https://a.espncdn.com/i/teamlogos/ncaa/500/301.png',
        'Tornados': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2913.png',
        'TOW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/119.png',
        'Towson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/119.png',
        'Towson Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/119.png',
        'Trailblazers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3101.png',
        'TRI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2977.png',
        'Tribe': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2729.png',
        'TRINBIB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3214.png',
        'Trine': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2651.png',
        'Trine University Thunder': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2651.png',
        'Trinity (CT) Bantams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2977.png',
        'Trinity Bible College Lions': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3214.png',
        'Trinity CT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2977.png',
        'Trinity TX': 'https://a.espncdn.com/i/teamlogos/ncaa/500/386.png',
        'Trinity University TX Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/386.png',
        'Trinty Bbl': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3214.png',
        'Trojans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/330.png',
        'Troy': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2653.png',
        'TROY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2653.png',
        'Troy Trojans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2653.png',
        'Troy Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3237.png',
        'TRTX': 'https://a.espncdn.com/i/teamlogos/ncaa/500/386.png',
        'TRU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2654.png',
        'Truman St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2654.png',
        'Truman State Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2654.png',
        'TTU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
        'TUF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112.png',
        'Tufts': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112.png',
        'Tufts Jumbos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112.png',
        'Tulane': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png',
        'Tulane Green Wave': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png',
        'TULN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png',
        'Tulsa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/202.png',
        'Tulsa Golden Hurricane': 'https://a.espncdn.com/i/teamlogos/ncaa/500/202.png',
        'TUS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2657.png',
        'Tusculum': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2839.png',
        'Tuskegee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2657.png',
        'Tuskegee Golden Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2657.png',
        'TX A&M Kng': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2658.png',
        'TXA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2658.png',
        'TXCL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2637.png',
        'TXPBAS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110243.png',
        'TXSO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2640.png',
        'TXST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/326.png',
        'U of Faith': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3254.png',
        'UAB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/5.png',
        'UAB Blazers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/5.png',
        'UALB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/399.png',
        'UAlbany': 'https://a.espncdn.com/i/teamlogos/ncaa/500/399.png',
        'UAlbany Great Danes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/399.png',
        'UAPB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2029.png',
        'UC Davis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/302.png',
        'UC Davis Aggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/302.png',
        'UCD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/302.png',
        'UCF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2116.png',
        'UCF Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2116.png',
        'UCLA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/26.png',
        'UCLA Bruins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/26.png',
        'UConn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png',
        'UConn Huskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png',
        'UFFL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3254.png',
        'UGA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
        'UIW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2916.png',
        'UK': 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
        'UL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/309.png',
        'UL Monroe': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2433.png',
        'UL Monroe Warhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2433.png',
        'ULM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2433.png',
        'UMass': 'https://a.espncdn.com/i/teamlogos/ncaa/500/113.png',
        'UMass Dart': 'https://a.espncdn.com/i/teamlogos/ncaa/500/379.png',
        'UMass Dartmouth Corsairs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/379.png',
        'UMD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/134.png',
        'UMEX': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3212.png',
        'UNA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2453.png',
        'UNC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
        'UNC Pembroke Braves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2882.png',
        'UNCO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2458.png',
        'UND': 'https://a.espncdn.com/i/teamlogos/ncaa/500/155.png',
        'UNH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/160.png',
        'UNI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2460.png',
        'Union': 'https://a.espncdn.com/i/teamlogos/ncaa/500/237.png',
        'Union Garnet Chargers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/237.png',
        'Univ of Mary': 'https://a.espncdn.com/i/teamlogos/ncaa/500/559.png',
        'University Of Charleston (WV) Golden Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2128.png',
        'University of Mary Marauders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/559.png',
        'University Of Mexico Mexico U': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3212.png',
        'University of Mount Union Raiders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/426.png',
        'University of Rochester (NY) Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/184.png',
        'University Of St Francis IN Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2831.png',
        'UNLV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2439.png',
        'UNLV Rebels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2439.png',
        'UNM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/167.png',
        'UNNY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/237.png',
        'UNT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/249.png',
        'UOO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/354.png',
        'UPP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/389.png',
        'Upper Iowa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/389.png',
        'Upper Iowa University Peacocks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/389.png',
        'URI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/227.png',
        'URS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2667.png',
        'Ursinus': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2667.png',
        'Ursinus Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2667.png',
        'USA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/6.png',
        'USC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
        'USC Trojans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
        'USCGA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2557.png',
        'USD': 'https://a.espncdn.com/i/teamlogos/ncaa/500/301.png',
        'USF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
        'USL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2779.png',
        'USM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png',
        'USU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
        'UT Martin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2630.png',
        'UT Martin Skyhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2630.png',
        'UT Permian Basin Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110243.png',
        'Utah': 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png',
        'UTAH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png',
        'Utah State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
        'Utah State Aggies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
        'Utah Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3101.png',
        'Utah Tech Trailblazers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3101.png',
        'Utah Utes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png',
        'UTC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/236.png',
        'UTEP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2638.png',
        'UTEP Miners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2638.png',
        'Utes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png',
        'Utica': 'https://a.espncdn.com/i/teamlogos/ncaa/500/390.png',
        'UTICA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/390.png',
        'Utica Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/390.png',
        'UTM': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2630.png',
        'UTPermianBasin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110243.png',
        'UTSA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2636.png',
        'UTSA Roadrunners': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2636.png',
        'UTU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3101.png',
        'UVA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
        'UVA Wise Cavaliers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2842.png',
        'UWL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2688.png',
        'VA State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/330.png',
        'VA Union': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2676.png',
        'VA Wise': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2842.png',
        'VAL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2674.png',
        'VALCST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/628.png',
        'Valdosta': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2673.png',
        'Valdosta State Blazers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2673.png',
        'Vall City': 'https://a.espncdn.com/i/teamlogos/ncaa/500/628.png',
        'Valley City St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/628.png',
        'Valley City State Valley City St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/628.png',
        'Valparaiso': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2674.png',
        'Valparaiso Beacons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2674.png',
        'VAN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png',
        'Vandals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/70.png',
        'Vanderbilt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png',
        'Vanderbilt Commodores': 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png',
        'Vikings': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3237.png',
        'VILL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/222.png',
        'Villanova': 'https://a.espncdn.com/i/teamlogos/ncaa/500/222.png',
        'Villanova Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/222.png',
        'VIR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/330.png',
        'Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
        'Virginia Cavaliers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
        'Virginia St Trojans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/330.png',
        'Virginia Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
        'Virginia Tech Hokies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
        'Virginia Union Panthers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2676.png',
        'Virginia University Of Lynchburg Dragons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2355.png',
        'VIRLYN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2355.png',
        'VIRWISE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2842.png',
        'VMI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2678.png',
        'VMI Keydets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2678.png',
        'Volunteers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
        'VT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
        'VU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2676.png',
        'Vulcans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2858.png',
        'W Alabama': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2695.png',
        'W Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2717.png',
        'W Chester': 'https://a.espncdn.com/i/teamlogos/ncaa/500/223.png',
        'W Colorado': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2714.png',
        'W Conn St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2843.png',
        'W Florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/110242.png',
        'W Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2710.png',
        'W Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2711.png',
        'W New Mex': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2703.png',
        'W Virginia St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2707.png',
        'W&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2729.png',
        'WAB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/89.png',
        'Wabash': 'https://a.espncdn.com/i/teamlogos/ncaa/500/89.png',
        'Wabash College Little Giants': 'https://a.espncdn.com/i/teamlogos/ncaa/500/89.png',
        'WAG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2681.png',
        'Wagner': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2681.png',
        'Wagner Seahawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2681.png',
        'WAKE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png',
        'Wake Forest': 'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png',
        'Wake Forest Demon Deacons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png',
        'WAL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2682.png',
        'Waldorf': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3080.png',
        'Waldorf College Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3080.png',
        'Walsh': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2682.png',
        'Walsh Cavaliers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2682.png',
        'WAR': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2685.png',
        'War Hawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/241.png',
        'Warhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2745.png',
        'WARNE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2683.png',
        'Warner': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2683.png',
        'Warner University Royals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2683.png',
        'Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2741.png',
        'Wartburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2685.png',
        'Wartburg Knights': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2685.png',
        'WAS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2686.png',
        'WASH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
        'Wash & Jeff': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2686.png',
        'Wash and Lee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2688.png',
        'Wash St Louis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/143.png',
        'Washburn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2687.png',
        'Washburn Ichabods': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2687.png',
        'Washington': 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
        'Washington & Jefferson Presidents': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2686.png',
        'Washington and Lee Generals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2688.png',
        'Washington Huskies': 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
        'Washington St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        'Washington State Cougars': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        'Washington University (St. Louis) Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/143.png',
        'Wasps': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2213.png',
        'WAY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/131.png',
        'Wayland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/630.png',
        'WAYLAND': 'https://a.espncdn.com/i/teamlogos/ncaa/500/630.png',
        'Wayland Baptist Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/630.png',
        'Wayne State (MI) Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/131.png',
        'Wayne State (NE) Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2844.png',
        'Wayne State MI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/131.png',
        'Wayne State NE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2844.png',
        'WAYNEB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2845.png',
        'Waynesburg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2845.png',
        'Waynesburg Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2845.png',
        'WCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2717.png',
        'WEB': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2692.png',
        'Webber Int': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2691.png',
        'Webber International Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2691.png',
        'WEBBINT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2691.png',
        'Weber St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2692.png',
        'Weber State Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2692.png',
        'WES': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2909.png',
        'Wesleyan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/336.png',
        'Wesleyan University (CT) Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/336.png',
        'WEST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/455.png',
        'WEST ': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2707.png',
        'West Alabama Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2695.png',
        'West Chester Golden Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/223.png',
        'West Georgia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2698.png',
        'West Georgia Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2698.png',
        'West Liberty': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2699.png',
        'West Liberty Hilltoppers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2699.png',
        'West Memphis Crusaders': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3211.png',
        'West Texas A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2704.png',
        'West Texas A&M Buffaloes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2704.png',
        'West Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png',
        'West Virginia Institute Of Tech Golden Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2706.png',
        'West Virginia Mountaineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png',
        'West Virginia State Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2707.png',
        'West Virginia Wesleyan Bobcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/455.png',
        'Western Carolina Catamounts': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2717.png',
        'Western Colorado Mountaineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2714.png',
        'Western Connecticut St Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2843.png',
        'Western Illinois Leathernecks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2710.png',
        'Western Kentucky Hilltoppers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/98.png',
        'Western KY': 'https://a.espncdn.com/i/teamlogos/ncaa/500/98.png',
        'Western Michigan Broncos': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2711.png',
        'Western NE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2702.png',
        'Western New England Golden Bears': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2702.png',
        'Western New Mexico Mustangs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2703.png',
        'Western Oregon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2848.png',
        'Western Oregon Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2848.png',
        'Westfield St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2909.png',
        'Westfield State Owls': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2909.png',
        'Westminster (PA) Titans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2849.png',
        'Westminster College (MO) Blue Jays': 'https://a.espncdn.com/i/teamlogos/ncaa/500/433.png',
        'WGA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2698.png',
        'Wheaton': 'https://a.espncdn.com/i/teamlogos/ncaa/500/396.png',
        'WHEATON': 'https://a.espncdn.com/i/teamlogos/ncaa/500/396.png',
        'Wheaton Thunder': 'https://a.espncdn.com/i/teamlogos/ncaa/500/396.png',
        'WHEEL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112335.png',
        'Wheeling': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112335.png',
        'Wheeling Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/112335.png',
        'WHI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2721.png',
        'White Mules': 'https://a.espncdn.com/i/teamlogos/ncaa/500/33.png',
        'Whitworth': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2721.png',
        'Whitworth Pirates': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2721.png',
        'WID': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2725.png',
        'Widener': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2725.png',
        'Widener Pride': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2725.png',
        'WIL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3130.png',
        'Wildcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2692.png',
        'Wilkes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/398.png',
        'WILKES': 'https://a.espncdn.com/i/teamlogos/ncaa/500/398.png',
        'Wilkes Colonels': 'https://a.espncdn.com/i/teamlogos/ncaa/500/398.png',
        'Will Paterson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2970.png',
        'Willamette': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2930.png',
        'Willamette Bearcats': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2930.png',
        'WILLI': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2911.png',
        'William & Mary': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2729.png',
        'William & Mary Tribe': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2729.png',
        'William Jewell': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2911.png',
        'William Jewell Cardinals': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2911.png',
        'William Paterson Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2970.png',
        'William Penn Statesmen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2912.png',
        'Williams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2731.png',
        'Williams Ephs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2731.png',
        'Williamson Trade School Mechanics': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3130.png',
        'WILLPAT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2970.png',
        'WILLPENN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2912.png',
        'Willtrade': 'https://a.espncdn.com/i/teamlogos/ncaa/500/3130.png',
        'Wilmington (OH) Fightin\' Quakers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2733.png',
        'Wilmington OH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2733.png',
        'WILMOH': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2733.png',
        'WILU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2741.png',
        'WIN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2851.png',
        'Wingate': 'https://a.espncdn.com/i/teamlogos/ncaa/500/351.png',
        'Wingate Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/351.png',
        'Winona State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2851.png',
        'Winona State Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2851.png',
        'Winston-Salem': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2736.png',
        'Winston-Salem Rams': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2736.png',
        'WIPL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/272.png',
        'WIRF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2723.png',
        'WIS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
        'Wis EC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2738.png',
        'Wis LC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2740.png',
        'Wis Luthrn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2741.png',
        'Wis Osh': 'https://a.espncdn.com/i/teamlogos/ncaa/500/271.png',
        'Wis Platte': 'https://a.espncdn.com/i/teamlogos/ncaa/500/272.png',
        'Wis RF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2723.png',
        'Wis Stevns': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2743.png',
        'Wis Stout': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2744.png',
        'Wis Whtwtr': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2745.png',
        'Wisconsin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
        'Wisconsin Badgers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
        'Wisconsin-Eau Claire Blugolds': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2738.png',
        'Wisconsin-Lacrosse Eagles': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2740.png',
        'Wisconsin-Lutheran Warriors': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2741.png',
        'Wisconsin-Oshkosh Titans': 'https://a.espncdn.com/i/teamlogos/ncaa/500/271.png',
        'Wisconsin-Platteville Pioneers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/272.png',
        'Wisconsin-River Falls Falcons': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2723.png',
        'Wisconsin-Stevens Pt Pointers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2743.png',
        'Wisconsin-Stout Blue Devils': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2744.png',
        'Wisconsin-Whitewater Warhawks': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2745.png',
        'WISE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2738.png',
        'WISL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2740.png',
        'WISO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/271.png',
        'WISP': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2743.png',
        'WISS': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2744.png',
        'WISW': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2745.png',
        'WITTEN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2746.png',
        'Wittenberg': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2746.png',
        'Wittenberg Tigers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2746.png',
        'WIU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2710.png',
        'WKU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/98.png',
        'WLIBST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2699.png',
        'WLLMTT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2930.png',
        'Wm Penn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2912.png',
        'WMN': 'https://a.espncdn.com/i/teamlogos/ncaa/500/433.png',
        'WMNPA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2849.png',
        'Wmnstermo': 'https://a.espncdn.com/i/teamlogos/ncaa/500/433.png',
        'Wmnsterpa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2849.png',
        'WMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2711.png',
        'WNMEX': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2703.png',
        'WNSL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2736.png',
        'WNST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2844.png',
        'WNWENG': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2702.png',
        'WOF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2747.png',
        'Wofford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2747.png',
        'Wofford Terriers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2747.png',
        'Wolf Pack': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
        'Wolfpack': 'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png',
        'Wolverines': 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
        'Wolves': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2848.png',
        'Wonder Boys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2033.png',
        'WOO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2748.png',
        'Wooster': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2748.png',
        'Wooster Fighting Scots': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2748.png',
        'Wor State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/402.png',
        'Wor Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2749.png',
        'WORCE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2749.png',
        'Worcester Polytechnic Institute Engineers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2749.png',
        'Worcester St Lancers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/402.png',
        'WORE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2848.png',
        'WORST': 'https://a.espncdn.com/i/teamlogos/ncaa/500/402.png',
        'WSCO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2714.png',
        'WSTL': 'https://a.espncdn.com/i/teamlogos/ncaa/500/143.png',
        'WSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        'WV Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2706.png',
        'WV Weslyan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/455.png',
        'WVT': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2706.png',
        'WVU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png',
        'WYO': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2751.png',
        'Wyoming': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2751.png',
        'Wyoming Cowboys': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2751.png',
        'Yale': 'https://a.espncdn.com/i/teamlogos/ncaa/500/43.png',
        'YALE': 'https://a.espncdn.com/i/teamlogos/ncaa/500/43.png',
        'Yale Bulldogs': 'https://a.espncdn.com/i/teamlogos/ncaa/500/43.png',
        'Yellow Jackets': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2707.png',
        'Yeomen': 'https://a.espncdn.com/i/teamlogos/ncaa/500/391.png',
        'Yotes': 'https://a.espncdn.com/i/teamlogos/ncaa/500/108382.png',
        'Youngstown St': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2754.png',
        'Youngstown State Penguins': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2754.png',
        'YSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2754.png',
        'Zips': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png'
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
                if (game.topBottom === 'top') inningState = 'Top';
                else if (game.topBottom === 'bot' || game.topBottom === 'bottom') inningState = 'Bot';
                else if (game.topBottom === 'mid' || game.topBottom === 'middle') inningState = 'Mid';
                else if (game.topBottom === 'end') inningState = 'End';
                
                periodInfo = `${inningState} ${inningText}`;
            } else if (game.period && game.period > 0) {
                // Fallback to period if inningNumber not available
                const inningText = game.period === 1 ? '1st' : 
                                  game.period === 2 ? '2nd' : 
                                  game.period === 3 ? '3rd' : 
                                  `${game.period}th`;
                
                let inningState = '';
                if (game.topBottom === 'top') inningState = 'Top';
                else if (game.topBottom === 'bot' || game.topBottom === 'bottom') inningState = 'Bot';
                else if (game.topBottom === 'mid' || game.topBottom === 'middle') inningState = 'Mid';
                else if (game.topBottom === 'end') inningState = 'End';
                
                periodInfo = `${inningState} ${inningText}`;
            } else {
                periodInfo = 'Top 1st';
            }
            
            // Count dots will be displayed next to bases (outside the bubble)
            
            // Store bases info separately (will be displayed outside the bubble)
            if (game.bases) {
                console.log(`Bases info available: ${game.bases}`);
            }
            
            console.log(`Final periodInfo: "${periodInfo}"`);
        } else if (game.sport === 'nhl') {
            periodInfo = `P${game.period || '1'}`;
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
        
        if (sport === 'nfl' || sport === 'ncaaf' || sport === 'nba' || sport === 'ncaab') {
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
            inningState = 'Top';
        } else if (game.topBottom === 'bot' || game.topBottom === 'bottom') {
            inningState = 'Bot';
        } else if (game.topBottom === 'mid' || game.topBottom === 'middle') {
            inningState = 'Mid';
        } else if (game.topBottom === 'end') {
            inningState = 'End';
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

// Get NHL game display text for live games
function getNHLDisplay(game) {
    if (game.sport !== 'nhl') return '';
    
    console.log(`=== NHL DISPLAY DEBUG ===`);
    console.log('Game:', game.awayTeam, 'vs', game.homeTeam);
    console.log('Period:', game.period);
    console.log('Clock:', game.clock);
    console.log('Clock type:', typeof game.clock);
    console.log('Clock value:', game.clock);
    
    let periodText = '';
    if (game.period) {
        if (game.period === 1) periodText = '1st';
        else if (game.period === 2) periodText = '2nd';
        else if (game.period === 3) periodText = '3rd';
        else if (game.period === 4) periodText = '4th';
        else if (game.period > 4) periodText = `${game.period}th`;
        else periodText = game.period.toString();
    }
    
    let timeText = '';
    if (game.clock) {
        // Convert to string first, then format time to be more human-readable
        const clockStr = String(game.clock);
        console.log('NHL Clock string:', clockStr);
        
        if (clockStr.includes(':')) {
            // Already formatted (e.g., "12:45")
            timeText = clockStr;
            console.log('Already formatted NHL time:', timeText);
        } else {
            // Convert seconds to MM:SS format
            const totalSeconds = parseInt(clockStr);
            if (!isNaN(totalSeconds)) {
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                console.log(`Converted ${totalSeconds} seconds to NHL time: ${timeText}`);
            } else {
                timeText = clockStr;
                console.log('Could not parse NHL clock as number, using raw value:', timeText);
            }
        }
    }
    
    const result = periodText && timeText ? `${timeText} ${periodText}` : 
                   periodText ? periodText : 
                   timeText ? timeText : '';
    
    console.log('NHL Final result:', result);
    console.log('=== END NHL DISPLAY DEBUG ===');
    
    return result;
}

function getNBADisplay(game) {
    if (game.sport !== 'nba') return '';
    
    console.log(`=== NBA DISPLAY DEBUG ===`);
    console.log('Game:', game.awayTeam, 'vs', game.homeTeam);
    console.log('Period:', game.period);
    console.log('Clock:', game.clock);
    console.log('Clock type:', typeof game.clock);
    console.log('Clock value:', game.clock);
    console.log('Game status:', game.status);
    console.log('Game description:', game.description);
    
    // Check for halftime scenarios
    const isHalftime = (
        game.description && game.description.toLowerCase().includes('halftime') ||
        game.description && game.description.toLowerCase().includes('half') ||
        (game.clock === '0:00' || game.clock === 0 || game.clock === '0') && 
        (game.period === 0 || game.period === null) && 
        game.status === 'live'
    );
    
    if (isHalftime) {
        console.log('NBA game is in halftime');
        return 'HALFTIME';
    }
    
    let periodText = '';
    if (game.period) {
        if (game.period === 1) periodText = '1st';
        else if (game.period === 2) periodText = '2nd';
        else if (game.period === 3) periodText = '3rd';
        else if (game.period === 4) periodText = '4th';
        else if (game.period > 4) periodText = `OT${game.period - 4}`;
        else periodText = game.period.toString();
    }
    
    let timeText = '';
    if (game.clock) {
        // Convert to string first, then format time to be more human-readable
        const clockStr = String(game.clock);
        console.log('NBA Clock string:', clockStr);
        
        if (clockStr.includes(':')) {
            // Already formatted (e.g., "12:45")
            timeText = clockStr;
            console.log('Already formatted NBA time:', timeText);
        } else {
            // Convert seconds to MM:SS format
            const totalSeconds = parseInt(clockStr);
            if (!isNaN(totalSeconds)) {
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                console.log(`Converted ${totalSeconds} seconds to NBA time: ${timeText}`);
            } else {
                timeText = clockStr;
                console.log('Could not parse NBA clock as number, using raw value:', timeText);
            }
        }
    }
    
    const result = periodText && timeText ? `${timeText} ${periodText}` : 
                   periodText ? periodText : 
                   timeText ? timeText : '';
    
    console.log('NBA Final result:', result);
    console.log('=== END NBA DISPLAY DEBUG ===');
    
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


