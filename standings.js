// Standings page functionality
let currentSport = 'all';
let currentTeam = null;
let standingsData = {};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Check for sport and team parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sportParam = urlParams.get('sport');
    const teamParam = urlParams.get('team');
    if (sportParam) {
        currentSport = sportParam;
    }
    if (teamParam) {
        currentTeam = decodeURIComponent(teamParam);
    }
    
    setupEventListeners();
    loadStandings();
});

function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = '/';
    });
    
    // Set initial sport filter value
    document.getElementById('sportFilter').value = currentSport;
    
    // Sport filter
    document.getElementById('sportFilter').addEventListener('change', (e) => {
        currentSport = e.target.value;
        displayStandings();
    });
}

async function loadStandings() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const standingsContainer = document.getElementById('standingsContainer');
    const errorMessage = document.getElementById('errorMessage');
    
    try {
        loadingIndicator.style.display = 'block';
        standingsContainer.style.display = 'none';
        errorMessage.style.display = 'none';
        
        // Load standings for all supported sports
        await Promise.all([
            loadNFLStandings(),
            loadNBAStandings(),
            loadMLBStandings(),
            loadNHLStandings()
        ]);
        
        loadingIndicator.style.display = 'none';
        standingsContainer.style.display = 'block';
        displayStandings();
        
    } catch (error) {
        console.error('Error loading standings:', error);
        loadingIndicator.style.display = 'none';
        errorMessage.style.display = 'block';
    }
}

async function loadNFLStandings() {
    try {
        console.log('Fetching NFL standings from:', ESPN_STANDINGS_APIS.nfl);
        const response = await fetch(ESPN_STANDINGS_APIS.nfl);
        console.log('NFL response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('NFL data received:', data);
        
        if (data.children && data.children.length > 0) {
            standingsData.nfl = data.children.map(conference => ({
                name: conference.name,
                divisions: conference.children.map(division => ({
                    name: division.name,
                    teams: division.standings.entries.map(team => ({
                        name: team.team.displayName,
                        shortName: team.team.abbreviation,
                        wins: team.stats.find(s => s.name === 'wins')?.value || 0,
                        losses: team.stats.find(s => s.name === 'losses')?.value || 0,
                        ties: team.stats.find(s => s.name === 'ties')?.value || 0,
                        winPercentage: team.stats.find(s => s.name === 'winPercent')?.value || 0,
                        gamesBehind: team.stats.find(s => s.name === 'gamesBehind')?.value || 0
                    }))
                }))
            }));
            console.log('NFL standings processed:', standingsData.nfl);
            console.log('NFL divisions:', standingsData.nfl[0].divisions.map(d => d.name));
            console.log('NFL teams in NFC South:', standingsData.nfl[1].divisions.find(d => d.name === 'NFC South')?.teams.map(t => t.name));
        } else {
            console.log('No NFL children found in data');
        }
    } catch (error) {
        console.error('Error loading NFL standings:', error);
    }
}

async function loadNBAStandings() {
    try {
        const response = await fetch(ESPN_STANDINGS_APIS.nba);
        const data = await response.json();
        
        if (data.children && data.children.length > 0) {
            standingsData.nba = data.children.map(conference => ({
                name: conference.name,
                divisions: conference.children.map(division => ({
                    name: division.name,
                    teams: division.standings.entries.map(team => ({
                        name: team.team.displayName,
                        shortName: team.team.abbreviation,
                        wins: team.stats.find(s => s.name === 'wins')?.value || 0,
                        losses: team.stats.find(s => s.name === 'losses')?.value || 0,
                        winPercentage: team.stats.find(s => s.name === 'winPercent')?.value || 0,
                        gamesBehind: team.stats.find(s => s.name === 'gamesBehind')?.value || 0
                    }))
                }))
            }));
        }
    } catch (error) {
        console.error('Error loading NBA standings:', error);
    }
}

async function loadMLBStandings() {
    try {
        const response = await fetch(ESPN_STANDINGS_APIS.mlb);
        const data = await response.json();
        
        if (data.children && data.children.length > 0) {
            standingsData.mlb = data.children.map(conference => ({
                name: conference.name,
                divisions: conference.children.map(division => ({
                    name: division.name,
                    teams: division.standings.entries.map(team => ({
                        name: team.team.displayName,
                        shortName: team.team.abbreviation,
                        wins: team.stats.find(s => s.name === 'wins')?.value || 0,
                        losses: team.stats.find(s => s.name === 'losses')?.value || 0,
                        winPercentage: team.stats.find(s => s.name === 'winPercent')?.value || 0,
                        gamesBehind: team.stats.find(s => s.name === 'gamesBehind')?.value || 0
                    }))
                }))
            }));
        }
    } catch (error) {
        console.error('Error loading MLB standings:', error);
    }
}

async function loadNHLStandings() {
    try {
        const response = await fetch(ESPN_STANDINGS_APIS.nhl);
        const data = await response.json();
        
        if (data.children && data.children.length > 0) {
            standingsData.nhl = data.children.map(conference => ({
                name: conference.name,
                divisions: conference.children.map(division => ({
                    name: division.name,
                    teams: division.standings.entries.map(team => ({
                        name: team.team.displayName,
                        shortName: team.team.abbreviation,
                        wins: team.stats.find(s => s.name === 'wins')?.value || 0,
                        losses: team.stats.find(s => s.name === 'losses')?.value || 0,
                        ties: team.stats.find(s => s.name === 'ties')?.value || 0,
                        winPercentage: team.stats.find(s => s.name === 'winPercent')?.value || 0,
                        points: team.stats.find(s => s.name === 'points')?.value || 0
                    }))
                }))
            }));
        }
    } catch (error) {
        console.error('Error loading NHL standings:', error);
    }
}

// ESPN API standings endpoints that provide real data
const ESPN_STANDINGS_APIS = {
    'nfl': 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?level=3',
    'nba': 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3',
    'mlb': 'https://site.web.api.espn.com/apis/v2/sports/baseball/mlb/standings?level=3',
    'nhl': 'https://site.web.api.espn.com/apis/v2/sports/hockey/nhl/standings?level=3'
};

// Get team logo URL for standings
function getTeamLogoUrl(teamName, sport) {
    if (sport === 'nfl') {
        return getNFLLogoUrl(teamName);
    } else if (sport === 'nba') {
        return getNBALogoUrl(teamName);
    } else if (sport === 'mlb') {
        return getMLBLogoUrl(teamName);
    } else if (sport === 'nhl') {
        return getNHLLogoUrl(teamName);
    }
    return null;
}

// Get NFL logo URLs
function getNFLLogoUrl(teamName) {
    const nflLogos = {
        'Arizona Cardinals': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
        'Atlanta Falcons': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
        'Baltimore Ravens': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
        'Buffalo Bills': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
        'Carolina Panthers': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
        'Chicago Bears': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
        'Cincinnati Bengals': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
        'Cleveland Browns': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
        'Dallas Cowboys': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
        'Denver Broncos': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
        'Detroit Lions': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
        'Green Bay Packers': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
        'Houston Texans': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
        'Indianapolis Colts': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
        'Jacksonville Jaguars': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
        'Kansas City Chiefs': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
        'Las Vegas Raiders': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
        'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
        'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
        'Miami Dolphins': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
        'Minnesota Vikings': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
        'New England Patriots': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
        'New Orleans Saints': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
        'New York Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
        'New York Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
        'Philadelphia Eagles': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
        'Pittsburgh Steelers': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
        'San Francisco 49ers': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
        'Seattle Seahawks': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
        'Tampa Bay Buccaneers': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
        'Tennessee Titans': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
        'Washington Commanders': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png'
    };
    
    return nflLogos[teamName] || null;
}

// Get NBA logo URLs
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
    
    return nbaLogos[teamName] || null;
}

// Get MLB logo URLs
function getMLBLogoUrl(teamName) {
    const mlbLogos = {
        'Arizona Diamondbacks': 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png',
        'Atlanta Braves': 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png',
        'Baltimore Orioles': 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png',
        'Boston Red Sox': 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png',
        'Chicago Cubs': 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png',
        'Chicago White Sox': 'https://a.espncdn.com/i/teamlogos/mlb/500/cws.png',
        'Cincinnati Reds': 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png',
        'Cleveland Guardians': 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png',
        'Colorado Rockies': 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png',
        'Detroit Tigers': 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png',
        'Houston Astros': 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png',
        'Kansas City Royals': 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png',
        'Los Angeles Angels': 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png',
        'Los Angeles Dodgers': 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
        'Miami Marlins': 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png',
        'Milwaukee Brewers': 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png',
        'Minnesota Twins': 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png',
        'New York Mets': 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png',
        'New York Yankees': 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
        'Oakland Athletics': 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png',
        'Philadelphia Phillies': 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png',
        'Pittsburgh Pirates': 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png',
        'San Diego Padres': 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png',
        'San Francisco Giants': 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png',
        'Seattle Mariners': 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png',
        'St. Louis Cardinals': 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png',
        'Tampa Bay Rays': 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png',
        'Texas Rangers': 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png',
        'Toronto Blue Jays': 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png',
        'Washington Nationals': 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png'
    };
    
    return mlbLogos[teamName] || null;
}

// Get NHL logo URLs
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

// Team to division mappings for each sport
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

// Function to find which division a team belongs to
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

function displayStandings() {
    const container = document.getElementById('standingsContainer');
    
    if (currentSport === 'all') {
        displayAllSports(container);
    } else {
        displaySingleSport(container, currentSport);
    }
}

function displayAllSports(container) {
    let html = '';
    
    Object.keys(standingsData).forEach(sport => {
        if (standingsData[sport]) {
            html += `<div class="sport-section">
                <h2 class="sport-title">${getSportDisplayName(sport)}</h2>
                ${generateSportHTML(sport)}
            </div>`;
        }
    });
    
    if (html === '') {
        html = '<div class="info-message"><p>No standings data available at this time. Please try again later.</p></div>';
    }
    
    container.innerHTML = html;
}

function displaySingleSport(container, sport) {
    console.log(`Displaying sport: ${sport}, currentTeam: ${currentTeam}`);
    console.log('Standings data available:', Object.keys(standingsData));
    
    if (!standingsData[sport]) {
        console.log(`No standings data for sport: ${sport}`);
        container.innerHTML = '<div class="info-message"><p>No standings data available for this sport at this time. Please try again later.</p></div>';
        return;
    }

    let html = `<div class="sport-section">
        <h2 class="sport-title">${getSportDisplayName(sport)}</h2>`;
    
    // If a specific team was clicked, show their division first
    if (currentTeam) {
        console.log(`Team clicked: ${currentTeam}, using special division display`);
        html += generateSportHTMLWithTeamDivision(sport, currentTeam);
    } else {
        console.log('No team clicked, using normal display');
        html += generateSportHTML(sport);
    }
    html += '</div>';
    
    container.innerHTML = html;
}

// Function to generate HTML with team's division shown first
function generateSportHTMLWithTeamDivision(sport, teamName) {
    const data = standingsData[sport];
    if (!data) {
        console.log('No standings data for sport:', sport);
        return generateSportHTML(sport);
    }

    const teamDivision = findTeamDivision(sport, teamName);
    if (!teamDivision) {
        console.log('No division found for team, using normal display');
        return generateSportHTML(sport);
    }

    console.log(`Reordering divisions to show "${teamDivision}" first`);
    let html = '';

    data.forEach(conference => {
        html += `<div class="conference-section">
            <h3 class="conference-title">${conference.name}</h3>
            <div class="divisions-container">`;

        // Sort divisions to show the team's division first
        const sortedDivisions = [...conference.divisions].sort((a, b) => {
            if (a.name === teamDivision) {
                console.log(`Moving ${a.name} to first position`);
                return -1;
            }
            if (b.name === teamDivision) {
                console.log(`Moving ${b.name} to first position`);
                return 1;
            }
            return 0;
        });

        console.log('Division order:', sortedDivisions.map(d => d.name));
        sortedDivisions.forEach(division => {
            html += `<div class="division-section">
                <h4 class="division-title">${division.name}</h4>
                <div class="standings-table">
                    <div class="table-header">
                        <span class="team-col">Team</span>
                        <span class="record-col">Record</span>
                        <span class="pct-col">PCT</span>
                        <span class="gb-col">GB</span>
                    </div>`;

            // Sort teams by standings position (win percentage, then points)
            const sortedTeams = [...division.teams].sort((a, b) => {
                // Primary sort: win percentage (higher is better)
                const aWinPct = a.winPercentage || 0;
                const bWinPct = b.winPercentage || 0;
                if (bWinPct !== aWinPct) {
                    return bWinPct - aWinPct;
                }
                
                // Secondary sort: points (higher is better)
                const aPoints = a.points || 0;
                const bPoints = b.points || 0;
                if (bPoints !== aPoints) {
                    return bPoints - aPoints;
                }
                
                // Tertiary sort: wins (higher is better)
                const aWins = a.wins || 0;
                const bWins = b.wins || 0;
                if (bWins !== aWins) {
                    return bWins - aWins;
                }
                
                // Final sort: fewer losses (lower is better)
                const aLosses = a.losses || 0;
                const bLosses = b.losses || 0;
                return aLosses - bLosses;
            });

             sortedTeams.forEach((team, index) => {
                 const record = team.ties !== undefined ? 
                     `${team.wins}-${team.losses}-${team.ties}` : 
                     `${team.wins}-${team.losses}`;

                 const logoUrl = getTeamLogoUrl(team.name, sport);
                 const logoHtml = logoUrl ? 
                     `<img src="${logoUrl}" alt="${team.name}" class="team-logo" onerror="this.style.display='none';" />` : 
                     `<div class="team-initials">${team.name.split(' ').map(word => word[0]).join('').substring(0, 2)}</div>`;

                 html += `<div class="team-row ${index === 0 ? 'first-place' : ''}">
                     <span class="team-col">
                         <div class="team-logo-container">
                             ${logoHtml}
                         </div>
                         <span class="team-name">${team.name}</span>
                     </span>
                     <span class="record-col">${record}</span>
                     <span class="pct-col">${team.winPercentage ? (team.winPercentage * 100).toFixed(1) + '%' : 'N/A'}</span>
                     <span class="gb-col">${team.gamesBehind || team.points || '-'}</span>
                 </div>`;
             });

            html += `</div></div>`;
        });

        html += `</div></div>`;
    });

    return html;
}

function generateSportHTML(sport) {
    const data = standingsData[sport];
    let html = '';

    data.forEach(conference => {
        html += `<div class="conference-section">
            <h3 class="conference-title">${conference.name}</h3>
            <div class="divisions-container">`;

        conference.divisions.forEach(division => {
            html += `<div class="division-section">
                <h4 class="division-title">${division.name}</h4>
                <div class="standings-table">
                    <div class="table-header">
                        <span class="team-col">Team</span>
                        <span class="record-col">Record</span>
                        <span class="pct-col">PCT</span>
                        <span class="gb-col">GB</span>
                    </div>`;

            // Sort teams by standings position (win percentage, then points)
            const sortedTeams = [...division.teams].sort((a, b) => {
                // Primary sort: win percentage (higher is better)
                const aWinPct = a.winPercentage || 0;
                const bWinPct = b.winPercentage || 0;
                if (bWinPct !== aWinPct) {
                    return bWinPct - aWinPct;
                }
                
                // Secondary sort: points (higher is better)
                const aPoints = a.points || 0;
                const bPoints = b.points || 0;
                if (bPoints !== aPoints) {
                    return bPoints - aPoints;
                }
                
                // Tertiary sort: wins (higher is better)
                const aWins = a.wins || 0;
                const bWins = b.wins || 0;
                if (bWins !== aWins) {
                    return bWins - aWins;
                }
                
                // Final sort: fewer losses (lower is better)
                const aLosses = a.losses || 0;
                const bLosses = b.losses || 0;
                return aLosses - bLosses;
            });

             sortedTeams.forEach((team, index) => {
                 const record = team.ties !== undefined ? 
                     `${team.wins}-${team.losses}-${team.ties}` : 
                     `${team.wins}-${team.losses}`;

                 const logoUrl = getTeamLogoUrl(team.name, sport);
                 const logoHtml = logoUrl ? 
                     `<img src="${logoUrl}" alt="${team.name}" class="team-logo" onerror="this.style.display='none';" />` : 
                     `<div class="team-initials">${team.name.split(' ').map(word => word[0]).join('').substring(0, 2)}</div>`;

                 html += `<div class="team-row ${index === 0 ? 'first-place' : ''}">
                     <span class="team-col">
                         <div class="team-logo-container">
                             ${logoHtml}
                         </div>
                         <span class="team-name">${team.name}</span>
                     </span>
                     <span class="record-col">${record}</span>
                     <span class="pct-col">${team.winPercentage ? (team.winPercentage * 100).toFixed(1) + '%' : 'N/A'}</span>
                     <span class="gb-col">${team.gamesBehind || team.points || '-'}</span>
                 </div>`;
             });

            html += `</div></div>`;
        });

        html += `</div></div>`;
    });

    return html;
}

function getSportDisplayName(sport) {
    const names = {
        'nfl': 'NFL',
        'nba': 'NBA',
        'mlb': 'MLB',
        'nhl': 'NHL',
        'college-football': 'College Football',
        'college-basketball': 'College Basketball'
    };
    return names[sport] || sport;
}
