// Team page functionality
let currentTeam = null;
let currentSport = null;
let teamData = {};
let standingsData = {};

// ESPN API endpoints
const ESPN_APIS = {
    nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
};

const ESPN_STANDINGS_APIS = {
    nfl: 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?level=3',
    nba: 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3',
    mlb: 'https://site.web.api.espn.com/apis/v2/sports/baseball/mlb/standings?level=3',
    nhl: 'https://site.web.api.espn.com/apis/v2/sports/hockey/nhl/standings?level=3'
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Check for sport and team parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sportParam = urlParams.get('sport');
    const teamParam = urlParams.get('team');
    
    console.log('=== TEAM PAGE INITIALIZATION ===');
    console.log('URL params:', window.location.search);
    console.log('Sport param:', sportParam);
    console.log('Team param:', teamParam);
    
    if (sportParam) {
        currentSport = sportParam;
        console.log('Set currentSport to:', currentSport);
    }
    if (teamParam) {
        currentTeam = decodeURIComponent(teamParam);
        console.log('Set currentTeam to:', currentTeam);
    }
    
    console.log('Final values - currentSport:', currentSport, 'currentTeam:', currentTeam);
    console.log('=== END INITIALIZATION ===');
    
    setupEventListeners();
    loadTeamData();
});

function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = '/';
    });
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Remove active class from all tabs and panels
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding panel
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Load tab content if needed
    if (tabName === 'division' && !standingsData[currentSport]) {
        loadDivisionStandings();
    } else if (tabName === 'schedule') {
        loadTeamSchedule();
    } else if (tabName === 'depth-chart') {
        loadDepthChart();
    }
}

async function loadTeamData() {
    if (!currentTeam || !currentSport) {
        showError('Missing team or sport information');
        return;
    }
    
    try {
        // Update page title and team info
        updateTeamInfo();
        
        // Load division standings for the division tab
        await loadDivisionStandings();
        
    } catch (error) {
        console.error('Error loading team data:', error);
        showError('Unable to load team information');
    }
}

function updateTeamInfo() {
    // Update team name
    document.getElementById('teamName').textContent = currentTeam;
    
    // Update team division
    const division = findTeamDivision(currentSport, currentTeam);
    document.getElementById('teamDivision').textContent = division || 'Unknown Division';
    
    // Update team logo
    const logoUrl = getTeamLogoUrl(currentTeam, currentSport);
    const teamLogoImg = document.getElementById('teamLogo');
    const teamLogoFallback = document.querySelector('.team-logo-fallback .team-initials');
    
    if (logoUrl) {
        teamLogoImg.src = logoUrl;
        teamLogoImg.style.display = 'block';
        teamLogoFallback.parentElement.style.display = 'none';
    } else {
        teamLogoImg.style.display = 'none';
        teamLogoFallback.textContent = currentTeam.split(' ').map(word => word[0]).join('').substring(0, 2);
        teamLogoFallback.parentElement.style.display = 'flex';
    }
    
    // Update team record if we have standings data
    updateTeamRecord();
}

function updateTeamRecord() {
    // Try to find team record from standings data if available
    if (standingsData[currentSport]) {
        const allTeams = [];
        standingsData[currentSport].children?.forEach(conference => {
            conference.children?.forEach(division => {
                allTeams.push(...(division.standings?.entries || []));
            });
        });
        
        const currentTeamData = allTeams.find(t => t.team.displayName === currentTeam);
        if (currentTeamData) {
            const wins = currentTeamData.stats.find(s => s.name === 'wins')?.value || 0;
            const losses = currentTeamData.stats.find(s => s.name === 'losses')?.value || 0;
            const ties = currentTeamData.stats.find(s => s.name === 'ties')?.value || 0;
            const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
            document.getElementById('teamRecord').textContent = record;
            return;
        }
    }
    
    // Show loading if no data available yet
    document.getElementById('teamRecord').textContent = 'Loading...';
}

function updateTeamRecordFromStandings(teams) {
    const currentTeamData = teams.find(t => t.team.displayName === currentTeam);
    if (currentTeamData) {
        const wins = currentTeamData.stats.find(s => s.name === 'wins')?.value || 0;
        const losses = currentTeamData.stats.find(s => s.name === 'losses')?.value || 0;
        const ties = currentTeamData.stats.find(s => s.name === 'ties')?.value || 0;
        const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
        document.getElementById('teamRecord').textContent = record;
    }
}

async function loadDivisionStandings() {
    if (!currentSport || standingsData[currentSport]) {
        displayDivisionStandings();
        return;
    }
    
    try {
        const loadingIndicator = document.getElementById('loadingIndicator');
        loadingIndicator.style.display = 'block';
        
        const response = await fetch(ESPN_STANDINGS_APIS[currentSport]);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        standingsData[currentSport] = data;
        
        loadingIndicator.style.display = 'none';
        displayDivisionStandings();
        
        // Update team record now that we have standings data
        updateTeamRecord();
        
    } catch (error) {
        console.error('Error loading division standings:', error);
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('divisionStandings').innerHTML = 
            '<div class="info-message"><p>Unable to load division standings</p></div>';
    }
}

function displayDivisionStandings() {
    const container = document.getElementById('divisionStandings');
    const teamDivision = findTeamDivision(currentSport, currentTeam);
    
    if (!teamDivision || !standingsData[currentSport]) {
        container.innerHTML = '<div class="info-message"><p>Division standings not available</p></div>';
        return;
    }
    
    // Find the division in the standings data
    const data = standingsData[currentSport];
    let divisionData = null;
    
    // Search through conferences and divisions
    for (const conference of data.children || []) {
        for (const division of conference.children || []) {
            if (division.name === teamDivision) {
                divisionData = division;
                break;
            }
        }
        if (divisionData) break;
    }
    
    if (!divisionData) {
        container.innerHTML = '<div class="info-message"><p>Division data not found</p></div>';
        return;
    }
    
    // Generate standings HTML
    let html = `<div class="division-section">
        <h4 class="division-title">${teamDivision}</h4>
        <div class="standings-table">
            <div class="table-header">
                <span class="team-col">Team</span>
                <span class="record-col">Record</span>
                <span class="pct-col">PCT</span>
                <span class="gb-col">GB</span>
            </div>`;
    
    // Sort teams by standings position
    const sortedTeams = [...divisionData.standings.entries].sort((a, b) => {
        const aWinPct = a.stats.find(s => s.name === 'winPercent')?.value || 0;
        const bWinPct = b.stats.find(s => s.name === 'winPercent')?.value || 0;
        return bWinPct - aWinPct;
    });
    
    sortedTeams.forEach((team, index) => {
        const wins = team.stats.find(s => s.name === 'wins')?.value || 0;
        const losses = team.stats.find(s => s.name === 'losses')?.value || 0;
        const ties = team.stats.find(s => s.name === 'ties')?.value || 0;
        const winPct = team.stats.find(s => s.name === 'winPercent')?.value || 0;
        const gamesBehind = team.stats.find(s => s.name === 'gamesBehind')?.value || 0;
        
        const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
        const isCurrentTeam = team.team.displayName === currentTeam;
        
        const logoUrl = getTeamLogoUrl(team.team.displayName, currentSport);
        const logoHtml = logoUrl ? 
            `<img src="${logoUrl}" alt="${team.team.displayName}" class="team-logo" onerror="this.style.display='none';" />` : 
            `<div class="team-initials">${team.team.displayName.split(' ').map(word => word[0]).join('').substring(0, 2)}</div>`;
        
        html += `<div class="team-row ${isCurrentTeam ? 'current-team' : ''} ${index === 0 ? 'first-place' : ''}">
            <span class="team-col">
                <div class="team-logo-container">
                    ${logoHtml}
                </div>
                <span class="team-name">${team.team.displayName}</span>
            </span>
            <span class="record-col">${record}</span>
            <span class="pct-col">${(winPct * 100).toFixed(1)}%</span>
            <span class="gb-col">${gamesBehind || '-'}</span>
        </div>`;
    });
    
    html += '</div></div>';
    container.innerHTML = html;
    
    // Update team record in header
    updateTeamRecordFromStandings(sortedTeams);
}

async function loadTeamSchedule() {
    if (!currentTeam || !currentSport) {
        document.getElementById('scheduleLoadingIndicator').style.display = 'none';
        document.getElementById('teamSchedule').innerHTML = 
            '<div class="info-message"><p>Unable to load schedule - missing team information</p></div>';
        return;
    }

    try {
        const loadingIndicator = document.getElementById('scheduleLoadingIndicator');
        loadingIndicator.style.display = 'block';
        
        // Get team ID first
        const teamId = await getTeamId(currentTeam, currentSport);
        if (!teamId) {
            throw new Error('Team ID not found');
        }
        
        // Fetch schedule data
        const scheduleUrl = getScheduleApiUrl(currentSport, teamId);
        console.log('Fetching schedule from:', scheduleUrl);
        
        const response = await fetch(scheduleUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Schedule data received:', data);
        
        loadingIndicator.style.display = 'none';
        displayTeamSchedule(data);
        
    } catch (error) {
        console.error('Error loading team schedule:', error);
        document.getElementById('scheduleLoadingIndicator').style.display = 'none';
        document.getElementById('teamSchedule').innerHTML = 
            '<div class="info-message"><p>Unable to load team schedule. Please try again later.</p></div>';
    }
}

async function getTeamId(teamName, sport) {
    // Try to get team ID from standings data first
    if (standingsData[sport]) {
        for (const conference of standingsData[sport].children || []) {
            for (const division of conference.children || []) {
                for (const team of division.standings.entries || []) {
                    if (team.team.displayName === teamName) {
                        console.log(`Found team ID for ${teamName}: ${team.team.id}`);
                        return team.team.id;
                    }
                }
            }
        }
    }
    
    // If not found in standings, try to fetch from ESPN's teams API
    try {
        const teamsUrl = `https://site.api.espn.com/apis/site/v2/sports/${getSportPath(sport)}/teams`;
        console.log('Fetching teams from:', teamsUrl);
        
        const response = await fetch(teamsUrl);
        if (response.ok) {
            const data = await response.json();
            const team = data.sports[0]?.leagues[0]?.teams?.find(t => 
                t.team.displayName === teamName || 
                t.team.abbreviation === teamName ||
                t.team.name === teamName
            );
            
            if (team) {
                console.log(`Found team ID for ${teamName}: ${team.team.id}`);
                return team.team.id;
            }
        }
    } catch (error) {
        console.error('Error fetching teams:', error);
    }
    
    console.log(`Team ID not found for: ${teamName}`);
    return null;
}

function getSportPath(sport) {
    const paths = {
        'nfl': 'football/nfl',
        'nba': 'basketball/nba',
        'mlb': 'baseball/mlb',
        'nhl': 'hockey/nhl'
    };
    return paths[sport] || sport;
}

function getScheduleApiUrl(sport, teamId) {
    const baseUrls = {
        'nfl': `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/schedule`,
        'nba': `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`,
        'mlb': `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${teamId}/schedule`,
        'nhl': `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${teamId}/schedule`
    };
    
    return baseUrls[sport] || null;
}

function displayTeamSchedule(data) {
    const container = document.getElementById('teamSchedule');
    
    console.log('Schedule data structure:', data);
    
    if (!data || typeof data !== 'object') {
        container.innerHTML = '<div class="info-message"><p>Invalid schedule data received.</p></div>';
        return;
    }
    
    if (!data.events || !Array.isArray(data.events) || data.events.length === 0) {
        container.innerHTML = '<div class="info-message"><p>No schedule data available for this team.</p></div>';
        return;
    }
    
    // Group games by date
    const gamesByDate = {};
    data.events.forEach(game => {
        const date = new Date(game.date);
        const dateKey = date.toDateString();
        
        if (!gamesByDate[dateKey]) {
            gamesByDate[dateKey] = [];
        }
        gamesByDate[dateKey].push(game);
    });
    
    // Sort dates
    const sortedDates = Object.keys(gamesByDate).sort((a, b) => new Date(a) - new Date(b));
    
    let html = '<div class="schedule-list">';
    
    sortedDates.forEach(dateKey => {
        const games = gamesByDate[dateKey];
        const date = new Date(dateKey);
        
        html += `<div class="schedule-date-section">
            <h4 class="schedule-date-header">${date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}</h4>
            <div class="schedule-games">`;
        
        games.forEach(game => {
            console.log('Game data:', game);
            
            if (!game || typeof game !== 'object') {
                console.warn('Invalid game data:', game);
                return;
            }
            
            const competition = game.competitions?.[0];
            if (!competition) {
                console.warn('No competition data for game:', game);
                return;
            }
            
            const homeTeam = competition.competitors?.find(comp => comp.homeAway === 'home');
            const awayTeam = competition.competitors?.find(comp => comp.homeAway === 'away');
            
            if (!homeTeam || !awayTeam) {
                console.warn('Missing team data for game:', game);
                return;
            }
            
            // Determine if current team is home or away
            const isHome = homeTeam?.team?.displayName === currentTeam;
            const opponent = isHome ? awayTeam : homeTeam;
            const teamData = isHome ? homeTeam : awayTeam;
            
            const opponentName = opponent?.team?.displayName || 'TBD';
            const opponentLogo = opponent?.team?.logos?.[0]?.href;
            
            const gameStatus = game.status?.type?.name || 'scheduled';
            const gameTime = game.status?.type?.name === 'STATUS_SCHEDULED' ? 
                new Date(game.date).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                }) : 
                game.status?.type?.description || '';
            
            const teamScore = teamData?.score?.displayValue || teamData?.score || '';
            const opponentScore = opponent?.score?.displayValue || opponent?.score || '';
            
            console.log('Team score:', teamScore, 'Type:', typeof teamScore);
            console.log('Opponent score:', opponentScore, 'Type:', typeof opponentScore);
            
            const venueName = competition.venue?.fullName || '';
            
            html += `<div class="schedule-game ${gameStatus.toLowerCase()}">
                <div class="game-info">
                    <div class="game-time">${String(gameTime)}</div>
                    <div class="game-venue">${String(venueName)}</div>
                </div>
                <div class="game-matchup">
                    <div class="team-info">
                        <img src="${String(getTeamLogoUrl(currentTeam, currentSport) || '')}" alt="${String(currentTeam)}" class="team-logo-small" onerror="this.style.display='none';">
                        <span class="team-name">${String(currentTeam)}</span>
                        ${teamScore && teamScore !== '' ? `<span class="score">${String(teamScore)}</span>` : ''}
                    </div>
                    <div class="vs-divider">vs</div>
                    <div class="team-info">
                        <img src="${String(opponentLogo || '')}" alt="${String(opponentName)}" class="team-logo-small" onerror="this.style.display='none';">
                        <span class="team-name">${String(opponentName)}</span>
                        ${opponentScore && opponentScore !== '' ? `<span class="score">${String(opponentScore)}</span>` : ''}
                    </div>
                </div>
                <div class="game-status ${gameStatus.toLowerCase()}">${String(game.status?.type?.description || 'Scheduled')}</div>
            </div>`;
        });
        
        html += '</div></div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function loadDepthChart() {
    if (!currentTeam || !currentSport) {
        document.getElementById('depthChart').innerHTML = 
            '<div class="info-message"><p>Unable to load depth chart - missing team information</p></div>';
        return;
    }

    try {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Loading roster...</p></div>';
        document.getElementById('depthChart').appendChild(loadingIndicator);
        
        // Get team ID first
        const teamId = await getTeamId(currentTeam, currentSport);
        if (!teamId) {
            throw new Error('Team ID not found');
        }
        
        // Fetch roster data from ESPN
        const rosterUrl = getRosterApiUrl(currentSport, teamId);
        console.log('Fetching roster from:', rosterUrl);
        
        const response = await fetch(rosterUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Roster data received:', data);
        
        loadingIndicator.remove();
        displayDepthChart(data);
        
    } catch (error) {
        console.error('Error loading depth chart:', error);
        document.getElementById('depthChart').innerHTML = 
            '<div class="info-message"><p>Unable to load roster data. Please try again later.</p></div>';
    }
}

function getRosterApiUrl(sport, teamId) {
    const baseUrls = {
        'nfl': `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`,
        'nba': `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`,
        'mlb': `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${teamId}/roster`,
        'nhl': `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${teamId}/roster`
    };
    
    return baseUrls[sport] || null;
}

function displayDepthChart(data) {
    const container = document.getElementById('depthChart');
    
    console.log('Roster data structure:', data);
    
    if (!data || !data.athletes || data.athletes.length === 0) {
        container.innerHTML = '<div class="info-message"><p>No roster data available for this team.</p></div>';
        return;
    }
    
    // Group players by position (ESPN groups by offense/defense, then we need to determine actual positions)
    const playersByPosition = {};
    
    data.athletes.forEach(positionGroup => {
        const players = positionGroup.items || [];
        
        players.forEach(player => {
            // Use the actual position from ESPN's API
            const position = player.position?.displayName || 'Unknown';
            
            if (!playersByPosition[position]) {
                playersByPosition[position] = [];
            }
            
            playersByPosition[position].push({
                number: player.jersey || '--',
                name: player.displayName || 'Unknown',
                college: player.college?.name || 'Unknown',
                height: player.displayHeight || '--',
                weight: player.displayWeight || '--',
                experience: player.experience?.years ? `${player.experience.years} years` : 'Rookie',
                age: player.age || '--'
            });
        });
    });
    
    // Sort positions and players
    const sortedPositions = Object.keys(playersByPosition).sort((a, b) => {
        // Custom sort order for NFL positions (using actual ESPN position names)
        const positionOrder = {
            'Quarterback': 1, 'Running Back': 2, 'Wide Receiver': 3, 'Tight End': 4,
            'Offensive Tackle': 5, 'Offensive Guard': 6, 'Center': 7, 'Offensive Line': 8,
            'Defensive End': 9, 'Defensive Tackle': 10, 'Defensive Line': 11,
            'Linebacker': 12, 'Cornerback': 13, 'Safety': 14, 'Defensive Back': 15,
            'Kicker': 16, 'Punter': 17, 'Long Snapper': 18, 'Special Teams': 19
        };
        
        const aOrder = positionOrder[a] || 99;
        const bOrder = positionOrder[b] || 99;
        return aOrder - bOrder;
    });
    
    let html = '<div class="depth-chart-list">';
    
    sortedPositions.forEach(position => {
        const players = playersByPosition[position];
        
        // Sort players by jersey number (starters typically have lower numbers)
        players.sort((a, b) => {
            const aNum = parseInt(a.number) || 999;
            const bNum = parseInt(b.number) || 999;
            return aNum - bNum;
        });
        
        html += `<div class="position-group">
            <h4 class="position-header">${position}</h4>
            <div class="players-list">`;
        
        players.forEach((player, index) => {
            const starterClass = index === 0 ? 'starter' : '';
            const depthLabel = index === 0 ? 'STARTER' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`;
            
            html += `<div class="player-row ${starterClass}">
                <div class="depth-label">${depthLabel}</div>
                <div class="player-info">
                    <span class="player-number">${player.number}</span>
                    <span class="player-name">${player.name}</span>
                    <span class="player-college">${player.college}</span>
                </div>
                <div class="player-stats">
                    <span class="height-weight">${player.height} / ${player.weight}</span>
                    <span class="experience">${player.experience} | Age: ${player.age}</span>
                </div>
            </div>`;
        });
        
        html += '</div></div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
}


function getMockDepthChart(sport) {
    // Mock data for demonstration - in reality, this would come from ESPN's roster API
    if (sport === 'nfl') {
        return {
            'Quarterback': [
                { number: '9', name: 'Derek Carr', college: 'Fresno State', height: '6-3', weight: '215', experience: '11th Season' },
                { number: '4', name: 'Jameis Winston', college: 'Florida State', height: '6-4', weight: '231', experience: '10th Season' },
                { number: '16', name: 'Jake Haener', college: 'Fresno State', height: '6-1', weight: '207', experience: '2nd Season' }
            ],
            'Running Back': [
                { number: '22', name: 'Alvin Kamara', college: 'Tennessee', height: '5-10', weight: '215', experience: '8th Season' },
                { number: '30', name: 'Jamaal Williams', college: 'BYU', height: '6-0', weight: '224', experience: '8th Season' },
                { number: '25', name: 'Kendre Miller', college: 'TCU', height: '5-11', weight: '215', experience: '2nd Season' }
            ],
            'Wide Receiver': [
                { number: '12', name: 'Chris Olave', college: 'Ohio State', height: '6-0', weight: '187', experience: '3rd Season' },
                { number: '17', name: 'Rashid Shaheed', college: 'Weber State', height: '5-10', weight: '172', experience: '3rd Season' },
                { number: '11', name: 'A.T. Perry', college: 'Wake Forest', height: '6-3', weight: '205', experience: '2nd Season' },
                { number: '88', name: 'Lynn Bowden Jr.', college: 'Kentucky', height: '5-11', weight: '199', experience: '5th Season' }
            ],
            'Tight End': [
                { number: '87', name: 'Juwan Johnson', college: 'Oregon', height: '6-4', weight: '231', experience: '5th Season' },
                { number: '82', name: 'Taysom Hill', college: 'BYU', height: '6-2', weight: '221', experience: '8th Season' },
                { number: '85', name: 'Foster Moreau', college: 'LSU', height: '6-4', weight: '250', experience: '6th Season' }
            ],
            'Offensive Line': [
                { number: '71', name: 'Trevor Penning', college: 'Northern Iowa', height: '6-7', weight: '325', experience: '3rd Season' },
                { number: '70', name: 'Erik McCoy', college: 'Texas A&M', height: '6-4', weight: '303', experience: '6th Season' },
                { number: '75', name: 'Cesar Ruiz', college: 'Michigan', height: '6-3', weight: '307', experience: '5th Season' }
            ],
            'Defensive Line': [
                { number: '94', name: 'Cameron Jordan', college: 'California', height: '6-4', weight: '287', experience: '14th Season' },
                { number: '93', name: 'Nathan Shepherd', college: 'Fort Hays State', height: '6-4', weight: '315', experience: '7th Season' },
                { number: '91', name: 'Bryan Bresee', college: 'Clemson', height: '6-5', weight: '305', experience: '2nd Season' }
            ],
            'Linebacker': [
                { number: '54', name: 'Demario Davis', college: 'Arkansas State', height: '6-2', weight: '248', experience: '13th Season' },
                { number: '42', name: 'Pete Werner', college: 'Ohio State', height: '6-3', weight: '242', experience: '4th Season' },
                { number: '55', name: 'Willie Gay Jr.', college: 'Mississippi State', height: '6-1', weight: '243', experience: '5th Season' }
            ],
            'Secondary': [
                { number: '23', name: 'Marshon Lattimore', college: 'Ohio State', height: '6-0', weight: '192', experience: '8th Season' },
                { number: '21', name: 'Paulson Adebo', college: 'Stanford', height: '6-1', weight: '192', experience: '4th Season' },
                { number: '32', name: 'Tyrann Mathieu', college: 'LSU', height: '5-9', weight: '190', experience: '12th Season' },
                { number: '43', name: 'Marcus Maye', college: 'Florida', height: '6-0', weight: '207', experience: '8th Season' }
            ]
        };
    }
    
    // Add other sports as needed
    return {
        'Coming Soon': [
            { number: '--', name: 'Depth chart data', college: 'Available soon', height: '--', weight: '--', experience: '--' }
        ]
    };
}

function showError(message) {
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('errorMessage').querySelector('p').textContent = message;
}

// Team division mapping (copied from standings.js)
const TEAM_DIVISIONS = {
    'nfl': {
        'AFC East': ['Buffalo Bills', 'Miami Dolphins', 'New England Patriots', 'New York Jets', 'Bills', 'Dolphins', 'Patriots', 'Jets'],
        'AFC North': ['Baltimore Ravens', 'Cincinnati Bengals', 'Cleveland Browns', 'Pittsburgh Steelers', 'Ravens', 'Bengals', 'Browns', 'Steelers'],
        'AFC South': ['Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans', 'Texans', 'Colts', 'Jaguars', 'Titans'],
        'AFC West': ['Denver Broncos', 'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Broncos', 'Chiefs', 'Raiders', 'Chargers'],
        'NFC East': ['Dallas Cowboys', 'New York Giants', 'Philadelphia Eagles', 'Washington Commanders', 'Cowboys', 'Giants', 'Eagles', 'Commanders'],
        'NFC North': ['Chicago Bears', 'Detroit Lions', 'Green Bay Packers', 'Minnesota Vikings', 'Bears', 'Lions', 'Packers', 'Vikings'],
        'NFC South': ['Atlanta Falcons', 'Carolina Panthers', 'New Orleans Saints', 'Tampa Bay Buccaneers', 'Falcons', 'Panthers', 'Saints', 'Buccaneers'],
        'NFC West': ['Arizona Cardinals', 'Los Angeles Rams', 'San Francisco 49ers', 'Seattle Seahawks', 'Cardinals', 'Rams', '49ers', 'Seahawks']
    },
    'nba': {
        'Eastern Conference - Atlantic': ['Boston Celtics', 'Brooklyn Nets', 'New York Knicks', 'Philadelphia 76ers', 'Toronto Raptors'],
        'Eastern Conference - Central': ['Chicago Bulls', 'Cleveland Cavaliers', 'Detroit Pistons', 'Indiana Pacers', 'Milwaukee Bucks'],
        'Eastern Conference - Southeast': ['Atlanta Hawks', 'Charlotte Hornets', 'Miami Heat', 'Orlando Magic', 'Washington Wizards'],
        'Western Conference - Northwest': ['Denver Nuggets', 'Minnesota Timberwolves', 'Oklahoma City Thunder', 'Portland Trail Blazers', 'Utah Jazz'],
        'Western Conference - Pacific': ['Golden State Warriors', 'LA Clippers', 'Los Angeles Lakers', 'Phoenix Suns', 'Sacramento Kings'],
        'Western Conference - Southwest': ['Dallas Mavericks', 'Houston Rockets', 'Memphis Grizzlies', 'New Orleans Pelicans', 'San Antonio Spurs']
    },
    'mlb': {
        'American League East': ['Baltimore Orioles', 'Boston Red Sox', 'New York Yankees', 'Tampa Bay Rays', 'Toronto Blue Jays'],
        'American League Central': ['Chicago White Sox', 'Cleveland Guardians', 'Detroit Tigers', 'Kansas City Royals', 'Minnesota Twins'],
        'American League West': ['Houston Astros', 'Los Angeles Angels', 'Oakland Athletics', 'Seattle Mariners', 'Texas Rangers'],
        'National League East': ['Atlanta Braves', 'Miami Marlins', 'New York Mets', 'Philadelphia Phillies', 'Washington Nationals'],
        'National League Central': ['Chicago Cubs', 'Cincinnati Reds', 'Milwaukee Brewers', 'Pittsburgh Pirates', 'St. Louis Cardinals'],
        'National League West': ['Arizona Diamondbacks', 'Colorado Rockies', 'Los Angeles Dodgers', 'San Diego Padres', 'San Francisco Giants']
    },
    'nhl': {
        'Eastern Conference - Atlantic': ['Boston Bruins', 'Buffalo Sabres', 'Detroit Red Wings', 'Florida Panthers', 'Montreal Canadiens', 'Ottawa Senators', 'Tampa Bay Lightning', 'Toronto Maple Leafs'],
        'Eastern Conference - Metropolitan': ['Carolina Hurricanes', 'Columbus Blue Jackets', 'New Jersey Devils', 'New York Islanders', 'New York Rangers', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'Washington Capitals'],
        'Western Conference - Central': ['Arizona Coyotes', 'Chicago Blackhawks', 'Colorado Avalanche', 'Dallas Stars', 'Minnesota Wild', 'Nashville Predators', 'St. Louis Blues', 'Winnipeg Jets'],
        'Western Conference - Pacific': ['Anaheim Ducks', 'Calgary Flames', 'Edmonton Oilers', 'Los Angeles Kings', 'San Jose Sharks', 'Seattle Kraken', 'Vancouver Canucks', 'Vegas Golden Knights']
    }
};

function findTeamDivision(sport, teamName) {
    console.log(`Looking for division for team: "${teamName}" in sport: ${sport}`);
    
    if (!TEAM_DIVISIONS[sport]) {
        console.log(`No team divisions found for sport: ${sport}`);
        return null;
    }
    
    // Try exact match first
    for (const [division, teams] of Object.entries(TEAM_DIVISIONS[sport])) {
        if (teams.includes(teamName)) {
            console.log(`Found exact match: ${teamName} in ${division}`);
            return division;
        }
    }
    
    // Try partial matching for team name variations
    const teamNameLower = teamName.toLowerCase();
    for (const [division, teams] of Object.entries(TEAM_DIVISIONS[sport])) {
        for (const team of teams) {
            const teamLower = team.toLowerCase();
            
            // Check if the clicked team name is contained in the full team name
            if (teamLower.includes(teamNameLower)) {
                console.log(`Found partial match: "${teamName}" matches "${team}" in ${division}`);
                return division;
            }
            
            // Check if the full team name is contained in the clicked team name
            if (teamNameLower.includes(teamLower)) {
                console.log(`Found reverse partial match: "${teamName}" contains "${team}" in ${division}`);
                return division;
            }
            
            // Check individual words
            const teamWords = teamLower.split(' ');
            const nameWords = teamNameLower.split(' ');
            
            for (const nameWord of nameWords) {
                if (nameWord.length > 2 && teamWords.includes(nameWord)) {
                    console.log(`Found word match: "${nameWord}" in "${team}" in ${division}`);
                    return division;
                }
            }
        }
    }
    
    console.log(`No division found for team: "${teamName}"`);
    return null;
}

// Logo functions (copied from script.js)
function getTeamLogoUrl(teamName, sport) {
    switch (sport) {
        case 'nfl':
            return getNFLLogoUrl(teamName);
        case 'nba':
            return getNBALogoUrl(teamName);
        case 'mlb':
            return getMLBLogoUrl(teamName);
        case 'nhl':
            return getNHLLogoUrl(teamName);
        default:
            return null;
    }
}

function getNFLLogoUrl(teamName) {
    const nflLogos = {
        'Buffalo Bills': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
        'Miami Dolphins': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
        'New England Patriots': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
        'New York Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
        'Baltimore Ravens': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
        'Cincinnati Bengals': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
        'Cleveland Browns': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
        'Pittsburgh Steelers': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
        'Houston Texans': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
        'Indianapolis Colts': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
        'Jacksonville Jaguars': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
        'Tennessee Titans': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
        'Denver Broncos': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
        'Kansas City Chiefs': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
        'Las Vegas Raiders': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
        'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
        'Dallas Cowboys': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
        'New York Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
        'Philadelphia Eagles': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
        'Washington Commanders': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
        'Chicago Bears': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
        'Detroit Lions': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
        'Green Bay Packers': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
        'Minnesota Vikings': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
        'Atlanta Falcons': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
        'Carolina Panthers': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
        'New Orleans Saints': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
        'Tampa Bay Buccaneers': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
        'Arizona Cardinals': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
        'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
        'San Francisco 49ers': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
        'Seattle Seahawks': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png'
    };
    
    return nflLogos[teamName] || null;
}

function getNBALogoUrl(teamName) {
    const nbaLogos = {
        'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
        'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
        'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
        'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
        'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
        'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
        'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
        'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
        'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
        'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
        'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
        'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
        'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
        'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
        'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
        'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
        'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
        'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
        'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
        'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
        'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
        'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
        'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
        'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
        'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
        'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
        'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
        'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
        'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
        'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png'
    };
    
    return nbaLogos[teamName] || null;
}

function getMLBLogoUrl(teamName) {
    const mlbLogos = {
        'Baltimore Orioles': 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png',
        'Boston Red Sox': 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png',
        'New York Yankees': 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
        'Tampa Bay Rays': 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png',
        'Toronto Blue Jays': 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png',
        'Chicago White Sox': 'https://a.espncdn.com/i/teamlogos/mlb/500/cws.png',
        'Cleveland Guardians': 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png',
        'Detroit Tigers': 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png',
        'Kansas City Royals': 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png',
        'Minnesota Twins': 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png',
        'Houston Astros': 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png',
        'Los Angeles Angels': 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png',
        'Oakland Athletics': 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png',
        'Seattle Mariners': 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png',
        'Texas Rangers': 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png',
        'Atlanta Braves': 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png',
        'Miami Marlins': 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png',
        'New York Mets': 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png',
        'Philadelphia Phillies': 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png',
        'Washington Nationals': 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png',
        'Chicago Cubs': 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png',
        'Cincinnati Reds': 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png',
        'Milwaukee Brewers': 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png',
        'Pittsburgh Pirates': 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png',
        'St. Louis Cardinals': 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png',
        'Arizona Diamondbacks': 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png',
        'Colorado Rockies': 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png',
        'Los Angeles Dodgers': 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
        'San Diego Padres': 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png',
        'San Francisco Giants': 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png'
    };
    
    return mlbLogos[teamName] || null;
}

function getNHLLogoUrl(teamName) {
    const nhlLogos = {
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
        'Winnipeg Jets': 'https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png'
    };
    
    return nhlLogos[teamName] || null;
}
