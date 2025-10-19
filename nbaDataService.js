/**
 * NBA Data Service
 * Fetches real-time NBA team rosters, stats, and projections
 */

const https = require('https');

class NBADataService {
  constructor() {
    // Using ESPN's public API for accurate, real-time NBA data
    this.espnApiHost = 'site.api.espn.com';
    this.espnApiPath = '/apis/site/v2/sports/basketball/nba';
  }

  /**
   * Get team information from ESPN API
   * @param {string} teamName - Team name
   * @returns {Promise<Object>} Team info with current roster and stats
   */
  async getTeamInfo(teamName) {
    try {
      const espnTeamId = this.getESPNTeamId(teamName);
      if (!espnTeamId) {
        return this.getFallbackTeamData(teamName);
      }

      // Fetch team data from ESPN API
      const teamData = await this.fetchESPNTeamData(espnTeamId);

      if (teamData) {
        return teamData;
      }

      return this.getFallbackTeamData(teamName);
    } catch (error) {
      console.error('Error fetching ESPN data:', error.message);
      return this.getFallbackTeamData(teamName);
    }
  }

  /**
   * Fetch team data from ESPN API
   * @param {string} espnTeamId - ESPN team ID
   * @returns {Promise<Object>} Team data
   */
  async fetchESPNTeamData(espnTeamId) {
    return new Promise((resolve) => {
      // Get team stats and standings
      const path = `${this.espnApiPath}/teams/${espnTeamId}`;

      const options = {
        hostname: this.espnApiHost,
        path: path,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (parsed.team) {
              const team = parsed.team;

              // Extract team record and standings
              let projectedWins = '41-41';
              let outlook = 'Competitive NBA team.';

              if (team.record && team.record.items && team.record.items.length > 0) {
                const record = team.record.items[0];
                if (record.stats) {
                  const wins = record.stats.find(s => s.name === 'wins');
                  const losses = record.stats.find(s => s.name === 'losses');
                  if (wins && losses) {
                    const winsVal = parseInt(wins.value);
                    const lossesVal = parseInt(losses.value);
                    const currentRecord = `${winsVal}-${lossesVal}`;
                    // Project to 82 games
                    const gamesPlayed = winsVal + lossesVal;
                    if (gamesPlayed >= 3) { // Project if at least 3 games played
                      const winPct = winsVal / gamesPlayed;
                      const projWins = Math.round(winPct * 82);
                      projectedWins = `~${projWins} wins projected (Current: ${currentRecord})`;
                    } else {
                      projectedWins = `Current: ${currentRecord}`;
                    }
                  }
                }
              }

              // Get team outlook
              outlook = this.generateTeamOutlook(team, parsed);

              // Get fallback data and merge with live data
              const fallback = this.getFallbackTeamData(team.displayName || team.name);

              resolve({
                projectedWins,
                outlook,
                stars: [], // Don't show hardcoded stars - they may be injured
                excitement: fallback ? fallback.excitement : 5
              });
              return;
            }

            resolve(null);
          } catch (e) {
            console.error('ESPN API parse error:', e.message);
            resolve(null);
          }
        });
      });

      req.on('error', (err) => {
        console.error('ESPN API request error:', err.message);
        resolve(null);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });

      req.end();
    });
  }

  /**
   * Generate team outlook based on current data
   * @param {Object} team - Team data
   * @param {Object} fullData - Full API response
   * @returns {string} Team outlook
   */
  generateTeamOutlook(team, fullData) {
    let outlook = '';

    if (team.standingSummary) {
      outlook = team.standingSummary;
    } else if (team.record && team.record.items && team.record.items.length > 0) {
      const record = team.record.items[0];
      if (record.summary) {
        outlook = `Current record: ${record.summary}. `;
      }
    }

    if (!outlook) {
      outlook = 'NBA team competing in current season.';
    }

    return outlook;
  }

  /**
   * Get ESPN team ID from name
   * @param {string} teamName - Team name
   * @returns {string} ESPN team ID
   */
  getESPNTeamId(teamName) {
    const teamIds = {
      'Boston Celtics': '2',
      'Cleveland Cavaliers': '5',
      'Philadelphia 76ers': '20',
      'Milwaukee Bucks': '15',
      'Miami Heat': '14',
      'Brooklyn Nets': '17',
      'Los Angeles Lakers': '13',
      'Golden State Warriors': '9',
      'Dallas Mavericks': '6',
      'Chicago Bulls': '4',
      'Washington Wizards': '27',
      'Minnesota Timberwolves': '16',
      'New York Knicks': '18',
      'Oklahoma City Thunder': '25',
      'Denver Nuggets': '7',
      'Phoenix Suns': '21'
    };
    return teamIds[teamName];
  }

  /**
   * Get fallback team data with accurate 2024-25 rosters and excitement ratings
   * @param {string} teamName - Team name
   * @returns {Object} Team data
   */
  getFallbackTeamData(teamName) {
    const data = {
      'Boston Celtics': {
        projectedWins: '58-62',
        outlook: 'Defending champions looking to repeat. Elite two-way play with great depth.',
        excitement: 10, // Championship rematch, elite team
        stars: [
          { name: 'Jayson Tatum', stats: '28.4 PPG, 8.6 RPG, 5.7 APG' },
          { name: 'Jaylen Brown', stats: '25.7 PPG, 6.2 RPG, 5.1 APG' },
          { name: 'Derrick White', stats: '15.1 PPG, 4.2 APG, 4.1 RPG' }
        ]
      },
      'Cleveland Cavaliers': {
        projectedWins: '55-58',
        outlook: 'Top contender in the East. Elite offense and improved defense under new coach.',
        excitement: 8,
        stars: [
          { name: 'Donovan Mitchell', stats: '24.3 PPG, 4.4 APG, 4.4 RPG' },
          { name: 'Darius Garland', stats: '20.6 PPG, 6.5 APG, 2.7 RPG' },
          { name: 'Evan Mobley', stats: '18.9 PPG, 8.8 RPG, 1.5 BPG' }
        ]
      },
      'Philadelphia 76ers': {
        projectedWins: '48-52',
        outlook: 'Contender when healthy. Big three of Embiid, Maxey, and George.',
        excitement: 9, // MVP Joel Embiid
        stars: [
          { name: 'Joel Embiid', stats: '34.7 PPG, 11.0 RPG, 1.7 BPG (2023-24)' },
          { name: 'Tyrese Maxey', stats: '25.9 PPG, 6.2 APG, 3.7 RPG (2023-24)' },
          { name: 'Paul George', stats: '22.6 PPG, 5.2 RPG, 3.5 APG (2023-24)' }
        ]
      },
      'Milwaukee Bucks': {
        projectedWins: '50-54',
        outlook: 'Perennial contender with two superstars. Experience and talent.',
        excitement: 9, // Giannis always exciting
        stars: [
          { name: 'Giannis Antetokounmpo', stats: '30.4 PPG, 11.5 RPG, 6.5 APG (2023-24)' },
          { name: 'Damian Lillard', stats: '24.3 PPG, 7.0 APG, 4.1 RPG (2023-24)' },
          { name: 'Brook Lopez', stats: '12.5 PPG, 5.2 RPG, 2.4 BPG (2023-24)' }
        ]
      },
      'Miami Heat': {
        projectedWins: '44-48',
        outlook: 'Tough defensive team. Never count them out in the playoffs.',
        excitement: 6,
        stars: [
          { name: 'Jimmy Butler', stats: '20.8 PPG, 5.3 RPG, 5.0 APG (2023-24)' },
          { name: 'Bam Adebayo', stats: '19.3 PPG, 10.4 RPG, 3.9 APG (2023-24)' },
          { name: 'Tyler Herro', stats: '20.8 PPG, 5.3 APG, 4.5 RPG (2023-24)' }
        ]
      },
      'Brooklyn Nets': {
        projectedWins: '32-40',
        outlook: 'Rebuilding team. Young core developing for the future.',
        excitement: 4, // Local rivalry but rebuilding
        stars: [
          { name: 'Cam Thomas', stats: '22.5 PPG, 3.2 APG, 2.9 RPG (2023-24)' },
          { name: 'Nic Claxton', stats: '11.8 PPG, 9.9 RPG, 2.1 BPG (2023-24)' },
          { name: 'Cameron Johnson', stats: '13.4 PPG, 4.3 RPG, 2.4 APG (2023-24)' }
        ]
      },
      'Los Angeles Lakers': {
        projectedWins: '46-50',
        outlook: 'Championship experience. LeBron and AD still elite when healthy.',
        excitement: 10, // LeBron at MSG is always a spectacle
        stars: [
          { name: 'LeBron James', stats: '25.7 PPG, 8.3 APG, 7.3 RPG (2023-24)' },
          { name: 'Anthony Davis', stats: '24.7 PPG, 12.6 RPG, 2.3 BPG (2023-24)' },
          { name: 'Austin Reaves', stats: '15.9 PPG, 5.5 APG, 4.3 RPG (2023-24)' }
        ]
      },
      'Golden State Warriors': {
        projectedWins: '44-48',
        outlook: 'Dynasty veterans still dangerous. Curry remains elite shooter.',
        excitement: 9, // Steph Curry show
        stars: [
          { name: 'Stephen Curry', stats: '26.4 PPG, 5.1 APG, 4.5 RPG (2023-24)' },
          { name: 'Andrew Wiggins', stats: '13.2 PPG, 4.5 RPG, 1.7 APG (2023-24)' },
          { name: 'Draymond Green', stats: '8.6 PPG, 7.2 RPG, 6.0 APG (2023-24)' }
        ]
      },
      'Dallas Mavericks': {
        projectedWins: '50-54',
        outlook: 'Recent Finals team. Elite offense with Luka and Kyrie.',
        excitement: 9, // Luka magic + Kyrie returns to MSG
        stars: [
          { name: 'Luka Doncic', stats: '33.9 PPG, 9.8 APG, 9.2 RPG (2023-24)' },
          { name: 'Kyrie Irving', stats: '25.6 PPG, 5.2 APG, 5.0 RPG (2023-24)' },
          { name: 'Klay Thompson', stats: '17.9 PPG, 3.3 RPG, 2.3 APG (2023-24)' }
        ]
      },
      'Chicago Bulls': {
        projectedWins: '38-44',
        outlook: 'Play-in contender. Talented but inconsistent roster.',
        excitement: 5,
        stars: [
          { name: 'Zach LaVine', stats: '19.5 PPG, 5.2 RPG, 3.9 APG (2023-24)' },
          { name: 'Nikola Vucevic', stats: '18.0 PPG, 10.5 RPG, 3.3 APG (2023-24)' },
          { name: 'Coby White', stats: '19.1 PPG, 5.1 APG, 4.5 RPG (2023-24)' }
        ]
      },
      'Washington Wizards': {
        projectedWins: '22-30',
        outlook: 'Young rebuilding team focused on development.',
        excitement: 3,
        stars: [
          { name: 'Jordan Poole', stats: '17.4 PPG, 4.4 APG, 2.7 RPG (2023-24)' },
          { name: 'Kyle Kuzma', stats: '22.2 PPG, 6.6 RPG, 4.2 APG (2023-24)' },
          { name: 'Bilal Coulibaly', stats: '8.4 PPG, 4.1 RPG, 1.7 APG (2023-24)' }
        ]
      },
      'Minnesota Timberwolves': {
        projectedWins: '50-54',
        outlook: 'Elite defense and young talent. Western Conference contender.',
        excitement: 8,
        stars: [
          { name: 'Anthony Edwards', stats: '25.9 PPG, 5.4 RPG, 5.1 APG (2023-24)' },
          { name: 'Julius Randle', stats: '24.0 PPG, 9.2 RPG, 5.0 APG (2023-24)' },
          { name: 'Rudy Gobert', stats: '14.0 PPG, 12.9 RPG, 2.1 BPG (2023-24)' }
        ]
      },
      'Oklahoma City Thunder': {
        projectedWins: '54-58',
        outlook: 'Young powerhouse. Elite defense and rising superstars.',
        excitement: 8, // SGA is must-see TV
        stars: [
          { name: 'Shai Gilgeous-Alexander', stats: '30.1 PPG, 6.2 APG, 5.5 RPG (2023-24)' },
          { name: 'Chet Holmgren', stats: '16.5 PPG, 7.9 RPG, 2.3 BPG (2023-24)' },
          { name: 'Jalen Williams', stats: '19.1 PPG, 4.5 APG, 4.0 RPG (2023-24)' }
        ]
      },
      'Denver Nuggets': {
        projectedWins: '52-56',
        outlook: 'Defending champions with the best player in the world.',
        excitement: 10, // Jokic is generational
        stars: [
          { name: 'Nikola Jokic', stats: '26.4 PPG, 12.4 RPG, 9.0 APG (2023-24)' },
          { name: 'Jamal Murray', stats: '21.2 PPG, 6.5 APG, 4.1 RPG (2023-24)' },
          { name: 'Aaron Gordon', stats: '13.9 PPG, 6.5 RPG, 3.5 APG (2023-24)' }
        ]
      },
      'Phoenix Suns': {
        projectedWins: '48-52',
        outlook: 'Star-studded trio looking for chemistry and health.',
        excitement: 9, // Durant, Booker, Beal
        stars: [
          { name: 'Kevin Durant', stats: '27.1 PPG, 6.6 RPG, 5.0 APG (2023-24)' },
          { name: 'Devin Booker', stats: '27.1 PPG, 6.9 APG, 4.5 RPG (2023-24)' },
          { name: 'Bradley Beal', stats: '18.2 PPG, 5.0 APG, 4.4 RPG (2023-24)' }
        ]
      }
    };

    return data[teamName] || null;
  }
}

module.exports = NBADataService;
