#!/usr/bin/env node

/**
 * Monthly Email Scheduler
 * Sends matchup recommendations highlighting exciting games at MSG
 */

const TicketAPI = require('./ticketAPI');
const EmailService = require('./emailService');
const NBADataService = require('./nbaDataService');
const fs = require('fs');
const yaml = require('js-yaml');

class MatchupScheduler {
  constructor(configPath = './config.yaml', prefsPath = './preferences.yaml') {
    this.config = this.loadConfig(configPath);
    this.prefs = this.loadConfig(prefsPath);
    this.ticketAPI = new TicketAPI(this.config.seatgeek);
    this.emailService = new EmailService(this.config.email);
    this.nbaData = new NBADataService();
  }

  loadConfig(path) {
    try {
      const fileContents = fs.readFileSync(path, 'utf8');
      return yaml.load(fileContents);
    } catch (e) {
      console.error(`Error loading ${path}:`, e.message);
      console.error('Please ensure the file exists and is properly formatted.');
      process.exit(1);
    }
  }

  /**
   * Run the matchup recommendation process
   * Fetches upcoming games, ranks by excitement, sends email
   */
  async runMatchupRecommendations() {
    console.log(`\n🏀 Starting Knicks Game Scout...`);
    console.log(`Date: ${new Date().toLocaleString()}\n`);

    try {
      // Fetch upcoming games from SeatGeek
      console.log('📡 Fetching upcoming games from SeatGeek...');
      const games = await this.ticketAPI.getUpcomingGames();

      if (games.length === 0) {
        console.log('No upcoming games found in the next 60 days.');
        return;
      }

      // Filter to games in next 60 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + 60);
      const upcomingGames = games.filter(game => {
        const gameDate = new Date(game.datetime_local);
        return gameDate <= cutoffDate && gameDate > new Date();
      });

      console.log(`Found ${upcomingGames.length} upcoming games.\n`);

      // Process games and get excitement ratings
      console.log('⭐ Rating matchups by excitement level...');
      const gamesWithRatings = [];

      for (const game of upcomingGames) {
        const opponent = this.ticketAPI.extractOpponent(game.title);
        const opponentInfo = await this.nbaData.getTeamInfo(opponent);
        const excitement = opponentInfo?.excitement || 5;

        // Check if this is a preferred opponent
        const isPreferred = this.prefs.preferences?.games?.preferred_opponents?.includes(opponent) || false;

        // Boost excitement for preferred opponents
        const adjustedExcitement = isPreferred ? Math.min(excitement + 1, 10) : excitement;

        gamesWithRatings.push({
          id: game.id,
          title: game.title,
          opponent: opponent,
          date: game.datetime_local,
          venue: game.venue.name,
          excitement: adjustedExcitement,
          isPreferred: isPreferred,
          opponentInfo: opponentInfo
        });

        const excitementLabel = adjustedExcitement >= 9 ? '🔥🔥🔥' :
                               adjustedExcitement >= 7 ? '🔥🔥' :
                               adjustedExcitement >= 6 ? '🔥' : '';
        console.log(`  ${excitementLabel} ${opponent} - Excitement: ${adjustedExcitement}/10${isPreferred ? ' (Preferred)' : ''}`);
      }

      // Sort by excitement level (highest first)
      gamesWithRatings.sort((a, b) => b.excitement - a.excitement);

      console.log(`\n📧 Sending matchup recommendations...`);
      const recipients = this.prefs.users.map(u => u.email);

      await this.emailService.sendMatchupRecommendations(recipients, gamesWithRatings);
      console.log(`✓ Email sent successfully to: ${recipients.join(', ')}\n`);

      // Log summary
      this.logSummary(gamesWithRatings);

      return gamesWithRatings;

    } catch (error) {
      console.error('Error running matchup recommendations:', error.message);
      throw error;
    }
  }

  /**
   * Log summary of matchups
   */
  logSummary(games) {
    console.log('='.repeat(70));
    console.log('UPCOMING MATCHUPS - SORTED BY EXCITEMENT');
    console.log('='.repeat(70));

    const mustSee = games.filter(g => g.excitement >= 9);
    const premier = games.filter(g => g.excitement >= 7 && g.excitement < 9);
    const exciting = games.filter(g => g.excitement >= 6 && g.excitement < 7);
    const standard = games.filter(g => g.excitement < 6);

    if (mustSee.length > 0) {
      console.log(`\n🔥🔥🔥 MUST-SEE GAMES (${mustSee.length}):`);
      mustSee.forEach(g => {
        const date = new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        console.log(`  ${date} - vs ${g.opponent}`);
      });
    }

    if (premier.length > 0) {
      console.log(`\n🔥🔥 PREMIER MATCHUPS (${premier.length}):`);
      premier.forEach(g => {
        const date = new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        console.log(`  ${date} - vs ${g.opponent}`);
      });
    }

    if (exciting.length > 0) {
      console.log(`\n🔥 EXCITING GAMES (${exciting.length}):`);
      exciting.forEach(g => {
        const date = new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        console.log(`  ${date} - vs ${g.opponent}`);
      });
    }

    if (standard.length > 0) {
      console.log(`\nStandard Matchups (${standard.length}):`);
      standard.forEach(g => {
        const date = new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        console.log(`  ${date} - vs ${g.opponent}`);
      });
    }

    console.log('\n' + '='.repeat(70) + '\n');
  }

  /**
   * Schedule monthly runs using node-cron
   */
  scheduleMonthly() {
    const cron = require('node-cron');

    // Run on the 1st of each month at 9:00 AM
    const schedule = this.config.scheduler?.cron || '0 9 1 * *';

    console.log(`📅 Scheduling monthly matchup recommendations with cron: ${schedule}`);
    console.log(`Next run will be on the 1st of next month at 9:00 AM\n`);

    cron.schedule(schedule, async () => {
      console.log('🔔 Scheduled task triggered!');
      await this.runMatchupRecommendations();
    });

    // Keep the process running
    console.log('Scheduler is running. Press Ctrl+C to exit.\n');
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const scheduler = new MatchupScheduler();

  if (command === 'schedule') {
    // Start the scheduler
    scheduler.scheduleMonthly();
  } else if (command === 'test-email') {
    // Test email configuration
    const testRecipient = args[1] || scheduler.prefs.users[0].email;
    console.log(`Sending test email to ${testRecipient}...`);
    scheduler.emailService.sendTestEmail(testRecipient)
      .then(() => {
        console.log('✓ Test email sent successfully!');
        process.exit(0);
      })
      .catch(err => {
        console.error('✗ Failed to send test email:', err.message);
        process.exit(1);
      });
  } else {
    // Run immediately
    scheduler.runMatchupRecommendations()
      .then(() => {
        console.log('✓ Matchup recommendation process completed successfully!');
        process.exit(0);
      })
      .catch(err => {
        console.error('✗ Matchup recommendation process failed:', err.message);
        process.exit(1);
      });
  }
}

module.exports = MatchupScheduler;
