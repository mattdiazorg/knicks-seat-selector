/**
 * Email Service
 * Sends matchup recommendations via email using Nodemailer
 */

const nodemailer = require('nodemailer');
const NBADataService = require('./nbaDataService');

class EmailService {
  constructor(config) {
    this.config = config;
    this.transporter = this.createTransporter();
    this.nbaData = new NBADataService();
  }

  createTransporter() {
    // Support multiple email providers
    if (this.config.service === 'gmail') {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.config.email,
          pass: this.config.password // App password for Gmail
        }
      });
    } else if (this.config.service === 'smtp') {
      return nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port || 587,
        secure: this.config.secure || false,
        auth: {
          user: this.config.email,
          pass: this.config.password
        }
      });
    } else {
      throw new Error('Unsupported email service');
    }
  }

  /**
   * Send matchup recommendations email
   * @param {Array} recipients - List of email addresses
   * @param {Array} games - Upcoming games with opponent data
   * @returns {Promise<Object>} Send result
   */
  async sendMatchupRecommendations(recipients, games) {
    const htmlContent = await this.generateMatchupEmailHTML(games);
    const textContent = await this.generateMatchupEmailText(games);

    const mailOptions = {
      from: `"Knicks Game Scout" <${this.config.email}>`,
      to: recipients.join(', '),
      subject: `🏀 Must-See Knicks Games This Month - ${this.getMonthYear()}`,
      text: textContent,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error.message);
      throw error;
    }
  }

  /**
   * Generate HTML email content focused on exciting matchups
   * @param {Array} games - Upcoming games with excitement ratings
   * @returns {Promise<string>} HTML content
   */
  async generateMatchupEmailHTML(games) {
    if (!games || games.length === 0) {
      return `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #F5F5F5;">
            <div style="background: white; padding: 30px; border-radius: 10px;">
              <h1 style="color: #006BB6; border-bottom: 4px solid #F58426; padding-bottom: 10px;">🏀 Knicks Game Scout</h1>
              <p style="font-size: 16px; color: #666;">No upcoming home games found in the next 60 days.</p>
              <p style="color: #888;">Check back next month for new matchups!</p>
            </div>
          </body>
        </html>
      `;
    }

    let gamesHTML = '';
    for (const game of games) {
      const gameDate = new Date(game.date);
      const formattedDate = gameDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      const dayOfWeek = gameDate.toLocaleDateString('en-US', { weekday: 'short' });
      const month = gameDate.toLocaleDateString('en-US', { month: 'short' });
      const day = gameDate.getDate();

      // Get opponent info from NBA Data Service
      const opponentInfo = await this.nbaData.getTeamInfo(game.opponent);

      // Generate excitement badge
      const excitement = opponentInfo?.excitement || 5;
      let excitementBadge = '';
      let excitementColor = '#999';
      let excitementText = 'Standard Matchup';

      if (excitement >= 9) {
        excitementBadge = '🔥🔥🔥';
        excitementColor = '#DC2626';
        excitementText = 'MUST-SEE GAME';
      } else if (excitement >= 7) {
        excitementBadge = '🔥🔥';
        excitementColor = '#EA580C';
        excitementText = 'PREMIER MATCHUP';
      } else if (excitement >= 6) {
        excitementBadge = '🔥';
        excitementColor = '#F59E0B';
        excitementText = 'Exciting Game';
      }

      // Generate star players section
      let starsHTML = '';
      if (opponentInfo && opponentInfo.stars && opponentInfo.stars.length > 0) {
        starsHTML = `
          <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <h4 style="color: #F58426; margin: 0 0 10px 0; font-size: 16px;">⭐ Star Players to Watch</h4>
            <div style="display: grid; gap: 8px;">
              ${opponentInfo.stars.map(star => `
                <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #006BB6;">
                  <div style="font-weight: bold; color: #1F2937;">${star.name}</div>
                  <div style="font-size: 13px; color: #6B7280;">${star.stats}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Team outlook
      let outlookHTML = '';
      if (opponentInfo && opponentInfo.outlook) {
        outlookHTML = `
          <div style="margin-top: 15px; padding: 12px; background: #EFF6FF; border-left: 3px solid #3B82F6; border-radius: 4px;">
            <div style="font-size: 13px; color: #1E40AF; font-weight: 600; margin-bottom: 5px;">Team Outlook</div>
            <div style="font-size: 14px; color: #1F2937;">${opponentInfo.outlook}</div>
            ${opponentInfo.projectedWins ? `<div style="font-size: 13px; color: #6B7280; margin-top: 5px;">Record: ${opponentInfo.projectedWins}</div>` : ''}
          </div>
        `;
      }

      // Ticket links
      const ticketLinksHTML = `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #E5E7EB;">
          <div style="font-size: 14px; color: #6B7280; margin-bottom: 10px;">Find Tickets:</div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <a href="https://www.stubhub.com/new-york-knicks-new-york-tickets/performer/429/" style="background: #FC4C02; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">StubHub</a>
            <a href="https://seatgeek.com/new-york-knicks-tickets" style="background: #6C4FBB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">SeatGeek</a>
            <a href="https://www.ticketmaster.com/new-york-knicks-tickets/artist/806024" style="background: #026CDF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Ticketmaster</a>
          </div>
        </div>
      `;

      gamesHTML += `
        <div style="background: white; margin: 20px 0; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Excitement Badge -->
          ${excitement >= 6 ? `
            <div style="background: ${excitementColor}; color: white; padding: 8px 20px; text-align: center; font-weight: bold; font-size: 14px;">
              ${excitementBadge} ${excitementText}
            </div>
          ` : ''}

          <!-- Game Header -->
          <div style="padding: 25px 25px 15px 25px;">
            <div style="display: flex; align-items: center; gap: 20px;">
              <!-- Date Badge -->
              <div style="background: #F58426; color: white; text-align: center; padding: 10px; border-radius: 8px; min-width: 60px;">
                <div style="font-size: 20px; font-weight: bold;">${day}</div>
                <div style="font-size: 12px; text-transform: uppercase;">${month}</div>
                <div style="font-size: 11px;">${dayOfWeek}</div>
              </div>

              <!-- Game Info -->
              <div style="flex: 1;">
                <h2 style="margin: 0; color: #006BB6; font-size: 28px;">vs ${game.opponent}</h2>
                <div style="color: #6B7280; margin-top: 5px; font-size: 14px;">${formattedDate}</div>
                <div style="color: #9CA3AF; font-size: 13px;">${game.venue}</div>
              </div>
            </div>
          </div>

          <!-- Game Content -->
          <div style="padding: 0 25px 25px 25px;">
            ${outlookHTML}
            ${starsHTML}
            ${ticketLinksHTML}
          </div>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background: #F5F5F5;">
          <div style="max-width: 700px; margin: 0 auto;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #006BB6 0%, #F58426 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏀 Knicks Game Scout</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your Monthly Guide to Must-See Matchups</p>
            </div>

            <!-- Games -->
            <div style="background: #FAFAFA; padding: 20px;">
              ${gamesHTML}
            </div>

            <!-- Footer -->
            <div style="background: #1F2937; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
              <p style="color: #9CA3AF; margin: 0; font-size: 13px;">Games sorted by excitement level • ${this.getMonthYear()}</p>
              <p style="color: #6B7280; margin: 10px 0 0 0; font-size: 12px;">🏀 Let's Go Knicks!</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content
   * @param {Array} games - Upcoming games
   * @returns {Promise<string>} Plain text content
   */
  async generateMatchupEmailText(games) {
    let text = `🏀 KNICKS GAME SCOUT - ${this.getMonthYear()}\n`;
    text += `Your Monthly Guide to Must-See Matchups\n`;
    text += `${'='.repeat(60)}\n\n`;

    if (!games || games.length === 0) {
      text += `No upcoming home games found in the next 60 days.\n`;
      text += `Check back next month for new matchups!\n`;
      return text;
    }

    for (const game of games) {
      const gameDate = new Date(game.date);
      const formattedDate = gameDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      const opponentInfo = await this.nbaData.getTeamInfo(game.opponent);
      const excitement = opponentInfo?.excitement || 5;

      let excitementBadge = '';
      if (excitement >= 9) excitementBadge = '🔥🔥🔥 MUST-SEE GAME';
      else if (excitement >= 7) excitementBadge = '🔥🔥 PREMIER MATCHUP';
      else if (excitement >= 6) excitementBadge = '🔥 Exciting Game';

      text += `${excitementBadge ? excitementBadge + '\n' : ''}`;
      text += `vs ${game.opponent}\n`;
      text += `${formattedDate}\n`;
      text += `${game.venue}\n\n`;

      if (opponentInfo) {
        if (opponentInfo.outlook) {
          text += `Team Outlook: ${opponentInfo.outlook}\n`;
          if (opponentInfo.projectedWins) {
            text += `Record: ${opponentInfo.projectedWins}\n`;
          }
          text += `\n`;
        }

        if (opponentInfo.stars && opponentInfo.stars.length > 0) {
          text += `⭐ Star Players to Watch:\n`;
          for (const star of opponentInfo.stars) {
            text += `  • ${star.name} - ${star.stats}\n`;
          }
          text += `\n`;
        }
      }

      text += `Find Tickets:\n`;
      text += `  StubHub: https://www.stubhub.com/new-york-knicks-new-york-tickets/performer/429/\n`;
      text += `  SeatGeek: https://seatgeek.com/new-york-knicks-tickets\n`;
      text += `  Ticketmaster: https://www.ticketmaster.com/new-york-knicks-tickets/artist/806024\n`;
      text += `\n${'-'.repeat(60)}\n\n`;
    }

    text += `🏀 Let's Go Knicks!\n`;
    return text;
  }

  /**
   * Send test email
   * @param {string} recipient - Email address
   * @returns {Promise<Object>} Send result
   */
  async sendTestEmail(recipient) {
    const mailOptions = {
      from: `"Knicks Game Scout" <${this.config.email}>`,
      to: recipient,
      subject: '🏀 Test Email - Knicks Game Scout',
      text: 'This is a test email from your Knicks Game Scout. If you receive this, your email configuration is working correctly!',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #006BB6;">🏀 Test Email Success!</h1>
            <p>Your Knicks Game Scout email configuration is working correctly.</p>
            <p>You'll receive monthly matchup recommendations highlighting the most exciting games at Madison Square Garden.</p>
            <p style="color: #F58426; font-weight: bold;">Let's Go Knicks!</p>
          </body>
        </html>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }

  /**
   * Get current month and year
   * @returns {string} Month Year format
   */
  getMonthYear() {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
}

module.exports = EmailService;
