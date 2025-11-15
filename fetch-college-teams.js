// Script to fetch all college football teams from ESPN API and build logo database
const https = require('https');

async function fetchCollegeFootballTeams() {
    try {
        console.log('Fetching college football teams from ESPN API...');
        
        // ESPN College Football Teams API endpoint
        const url = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams';
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`Found ${data.sports[0].leagues[0].teams.length} teams`);
        
        const teamDatabase = {};
        
        data.sports[0].leagues[0].teams.forEach(team => {
            const teamInfo = team.team;
            const teamId = teamInfo.id;
            const teamName = teamInfo.name;
            const shortName = teamInfo.shortDisplayName;
            const displayName = teamInfo.displayName;
            
            // Create logo URL
            const logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
            
            // Add all possible name variations
            teamDatabase[teamName] = logoUrl;
            if (shortName && shortName !== teamName) {
                teamDatabase[shortName] = logoUrl;
            }
            if (displayName && displayName !== teamName && displayName !== shortName) {
                teamDatabase[displayName] = logoUrl;
            }
            
            console.log(`Team ID ${teamId}: ${teamName} (${shortName}) - ${logoUrl}`);
        });
        
        // Generate JavaScript object for the database
        console.log('\n=== COLLEGE FOOTBALL LOGO DATABASE ===');
        console.log('const collegeFootballLogos = {');
        
        Object.entries(teamDatabase).forEach(([name, url], index, array) => {
            const isLast = index === array.length - 1;
            console.log(`    '${name}': '${url}'${isLast ? '' : ','}`);
        });
        
        console.log('};');
        
        console.log(`\nTotal entries: ${Object.keys(teamDatabase).length}`);
        
    } catch (error) {
        console.error('Error fetching teams:', error);
    }
}

fetchCollegeFootballTeams();
