// Script to fetch ALL college football teams from ESPN API
const https = require('https');

async function fetchAllCollegeFootballTeams() {
    try {
        console.log('Fetching ALL college football teams from ESPN API...');
        
        // Try different ESPN endpoints to get comprehensive team list
        const endpoints = [
            'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams',
            'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000',
            'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=2000'
        ];
        
        let allTeams = new Map();
        
        for (const url of endpoints) {
            try {
                console.log(`Trying: ${url}`);
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.sports && data.sports[0] && data.sports[0].leagues) {
                    data.sports[0].leagues.forEach(league => {
                        if (league.teams) {
                            league.teams.forEach(team => {
                                const teamInfo = team.team;
                                const teamId = teamInfo.id;
                                const teamName = teamInfo.name;
                                const shortName = teamInfo.shortDisplayName;
                                const displayName = teamInfo.displayName;
                                
                                // Store by team ID to avoid duplicates
                                if (!allTeams.has(teamId)) {
                                    allTeams.set(teamId, {
                                        id: teamId,
                                        name: teamName,
                                        shortName: shortName,
                                        displayName: displayName
                                    });
                                }
                            });
                        }
                    });
                }
                
                console.log(`Found ${allTeams.size} unique teams so far`);
            } catch (error) {
                console.log(`Error with ${url}:`, error.message);
            }
        }
        
        // Also try to get teams from the scores API
        try {
            console.log('Trying scores API for more teams...');
            const scoresUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';
            const response = await fetch(scoresUrl);
            const data = await response.json();
            
            if (data.events) {
                data.events.forEach(event => {
                    if (event.competitions) {
                        event.competitions.forEach(competition => {
                            if (competition.competitors) {
                                competition.competitors.forEach(competitor => {
                                    const team = competitor.team;
                                    const teamId = team.id;
                                    
                                    if (!allTeams.has(teamId)) {
                                        allTeams.set(teamId, {
                                            id: teamId,
                                            name: team.name,
                                            shortName: team.shortDisplayName,
                                            displayName: team.displayName
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        } catch (error) {
            console.log('Error with scores API:', error.message);
        }
        
        console.log(`\nTotal unique teams found: ${allTeams.size}`);
        
        // Generate the database
        const teamDatabase = {};
        
        allTeams.forEach(team => {
            const logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`;
            
            // Add all possible name variations
            teamDatabase[team.name] = logoUrl;
            if (team.shortName && team.shortName !== team.name) {
                teamDatabase[team.shortName] = logoUrl;
            }
            if (team.displayName && team.displayName !== team.name && team.displayName !== team.shortName) {
                teamDatabase[team.displayName] = logoUrl;
            }
            
            console.log(`Team ID ${team.id}: ${team.name} (${team.shortName}) - ${logoUrl}`);
        });
        
        // Generate JavaScript object for the database
        console.log('\n=== COMPLETE COLLEGE FOOTBALL LOGO DATABASE ===');
        console.log('const collegeFootballLogos = {');
        
        Object.entries(teamDatabase).forEach(([name, url], index, array) => {
            const isLast = index === array.length - 1;
            console.log(`    '${name}': '${url}'${isLast ? '' : ','}`);
        });
        
        console.log('};');
        
        console.log(`\nTotal database entries: ${Object.keys(teamDatabase).length}`);
        
    } catch (error) {
        console.error('Error fetching teams:', error);
    }
}

fetchAllCollegeFootballTeams();
