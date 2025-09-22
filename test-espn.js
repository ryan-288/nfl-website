// Test script to see what ESPN API actually returns
const https = require('https');

const year = new Date().getFullYear();
const month = String(new Date().getMonth() + 1).padStart(2, '0');
const day = String(new Date().getDate()).padStart(2, '0');
const dateParam = `${year}${month}${day}`;
const apiUrl = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${dateParam}`;

console.log('Testing ESPN API URL:', apiUrl);

https.get(apiUrl, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const jsonData = JSON.parse(data);
            console.log('\n=== ESPN API RESPONSE ===');
            console.log('Total events:', jsonData.events?.length || 0);
            
            if (jsonData.events && jsonData.events.length > 0) {
                const firstEvent = jsonData.events[0];
                console.log('\nFirst event:');
                console.log('Event ID:', firstEvent.id);
                console.log('Event name:', firstEvent.name);
                
                if (firstEvent.competitions && firstEvent.competitions[0] && firstEvent.competitions[0].competitors) {
                    const competitors = firstEvent.competitions[0].competitors;
                    console.log('\nCompetitors:');
                    
                    competitors.forEach((comp, index) => {
                        console.log(`\nCompetitor ${index}:`);
                        console.log('  Home/Away:', comp.homeAway);
                        console.log('  Team object:', JSON.stringify(comp.team, null, 2));
                    });
                }
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    });
}).on('error', (error) => {
    console.error('Error:', error);
});
