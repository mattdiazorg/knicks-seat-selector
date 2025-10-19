#!/usr/bin/env node

/**
 * Monthly Email Scheduler
 * Runs seat recommendations and sends monthly emails
 */

const KnicksSeatSelector = require('./seatSelector');
const TicketAPI = require('./ticketAPI');
const EmailService = require('./emailService');
const fs = require('fs');
const yaml = require('js-yaml');

class RecommendationScheduler {
  constructor(configPath = './config.yaml') {
    this.config = this.loadConfig(configPath);
    this.selector = new KnicksSeatSelector();
    this.ticketAPI = new TicketAPI(this.config.seatgeek.api_key);
    this.emailService = new EmailService(this.config.email);
  }

  loadConfig(path) {
    try {
      const fileContents = fs.readFileSync(path, 'utf8');
      return yaml.load(fileContents);
    } catch (e) {
      console.error('Error loading config:', e.message);
      console.error('Please create a config.yaml file with your API keys and email settings.');
      process.exit(1);
    }
  }

  /**
   * Run the recommendation process
   * Fetches tickets, analyzes them, and sends recommendations
   */
  async runRecommendations() {
    console.log(`\n🏀 Starting Knicks Seat Recommendation Process...`);
    console.log(`Date: ${new Date().toLocaleString()}\n`);

    try {
      // Fetch upcoming games and tickets
      console.log('📡 Fetching upcoming games from SeatGeek...');
      const gameData = await this.ticketAPI.getUpcomingRecommendations(60);

      if (gameData.length === 0) {
        console.log('No upcoming games found in the next 60 days.');
        return;
      }

      console.log(`Found ${gameData.length} upcoming games with tickets.\n`);

      // Process each game and find best seats
      const recommendations = [];
      for (const data of gameData) {
        console.log(`Analyzing tickets for: ${data.game.title}`);
        const bestSeats = this.selector.findBestSeats(data.tickets);

        if (bestSeats) {
          // Get top recommendations
          const allScored = data.tickets
            .map(ticket => {
              const sectionType = this.getSectionType(ticket.section);
              if (!sectionType) return null;
              const score = this.selector.scoreSection(ticket.section, ticket, sectionType);
              if (score === 0) return null;
              return {
                ...ticket,
                score,
                totalCost: ticket.price * ticket.seats.length,
                elevation: sectionType.elevation
              };
            })
            .filter(t => t !== null)
            .sort((a, b) => b.score - a.score);

          if (allScored.length > 0) {
            recommendations.push({
              game: data.game,
              bestSeats: allScored.slice(0, 5) // Top 5 recommendations
            });
            console.log(`  ✓ Found ${allScored.length} matching seats\n`);
          }
        }
      }

      if (recommendations.length === 0) {
        console.log('No seats found matching your preferences.');
        return;
      }

      // Send email recommendations
      console.log('📧 Sending email recommendations...');
      const recipients = this.selector.preferences.users.map(u => u.email);

      await this.emailService.sendRecommendations(recipients, recommendations);
      console.log(`✓ Email sent successfully to: ${recipients.join(', ')}\n`);

      // Log summary
      this.logSummary(recommendations);

      return recommendations;

    } catch (error) {
      console.error('Error running recommendations:', error.message);
      throw error;
    }
  }

  /**
   * Get section type info for a section
   */
  getSectionType(section) {
    const msgSeats = this.selector.msgSeats;
    for (const [type, info] of Object.entries(msgSeats)) {
      if (info.sections.includes(section)) {
        return info;
      }
    }
    return null;
  }

  /**
   * Log summary of recommendations
   */
  logSummary(recommendations) {
    console.log('='.repeat(60));
    console.log('RECOMMENDATION SUMMARY');
    console.log('='.repeat(60));
    for (const rec of recommendations) {
      const gameDate = new Date(rec.game.date);
      console.log(`\n${rec.game.opponent}`);
      console.log(`Date: ${gameDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);
      if (rec.bestSeats.length > 0) {
        const best = rec.bestSeats[0];
        console.log(`Best: Section ${best.section}, Row ${best.row} - $${best.price}/seat (Score: ${best.score})`);
      }
    }
    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Schedule monthly runs using node-cron
   */
  scheduleMonthly() {
    const cron = require('node-cron');

    // Run on the 1st of each month at 9:00 AM
    const schedule = this.config.scheduler?.cron || '0 9 1 * *';

    console.log(`📅 Scheduling monthly recommendations with cron: ${schedule}`);
    console.log(`Next run will be on the 1st of next month at 9:00 AM\n`);

    cron.schedule(schedule, async () => {
      console.log('🔔 Scheduled task triggered!');
      await this.runRecommendations();
    });

    // Keep the process running
    console.log('Scheduler is running. Press Ctrl+C to exit.\n');
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const scheduler = new RecommendationScheduler();

  if (command === 'schedule') {
    // Start the scheduler
    scheduler.scheduleMonthly();
  } else if (command === 'test-email') {
    // Test email configuration
    const testRecipient = args[1] || scheduler.selector.preferences.users[0].email;
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
    scheduler.runRecommendations()
      .then(() => {
        console.log('✓ Recommendation process completed successfully!');
        process.exit(0);
      })
      .catch(err => {
        console.error('✗ Recommendation process failed:', err.message);
        process.exit(1);
      });
  }
}

module.exports = RecommendationScheduler;
