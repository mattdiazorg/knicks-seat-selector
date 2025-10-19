/**
 * Email Service
 * Sends seat recommendations via email using Nodemailer
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor(config) {
    this.config = config;
    this.transporter = this.createTransporter();
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
   * Send seat recommendations email
   * @param {Array} recipients - List of email addresses
   * @param {Array} recommendations - Game and ticket recommendations
   * @returns {Promise<Object>} Send result
   */
  async sendRecommendations(recipients, recommendations) {
    const htmlContent = this.generateEmailHTML(recommendations);
    const textContent = this.generateEmailText(recommendations);

    const mailOptions = {
      from: `"Knicks Seat Selector" <${this.config.email}>`,
      to: recipients.join(', '),
      subject: `🏀 Your Monthly Knicks Seat Recommendations - ${this.getMonthYear()}`,
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
   * Generate HTML email content
   * @param {Array} recommendations - Game and ticket recommendations
   * @returns {string} HTML content
   */
  generateEmailHTML(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #006BB6;">🏀 Knicks Seat Recommendations</h1>
            <p>No games found matching your preferences in the next 60 days.</p>
            <p>Check back next month for new recommendations!</p>
          </body>
        </html>
      `;
    }

    let gamesHTML = '';
    for (const rec of recommendations) {
      const gameDate = new Date(rec.game.date);
      const formattedDate = gameDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      // Get top 3 recommendations
      const topSeats = rec.bestSeats.slice(0, 3);

      let seatsHTML = '';
      for (let i = 0; i < topSeats.length; i++) {
        const seat = topSeats[i];
        const badge = i === 0 ? '⭐ BEST MATCH' : `#${i + 1}`;
        seatsHTML += `
          <div style="background: ${i === 0 ? '#f0f8ff' : '#f9f9f9'}; padding: 15px; margin: 10px 0; border-left: 4px solid ${i === 0 ? '#006BB6' : '#ccc'}; border-radius: 4px;">
            <div style="font-weight: bold; color: #006BB6; margin-bottom: 5px;">${badge}</div>
            <div><strong>Section ${seat.section}, Row ${seat.row}</strong></div>
            <div>Seats: ${seat.seats.join(', ')} ${seat.isAisle ? '(Aisle)' : ''}</div>
            <div style="font-size: 18px; color: #F58426; margin: 5px 0;"><strong>$${seat.price}/seat</strong> (Total: $${seat.totalCost})</div>
            <div>Match Score: ${seat.score}/100</div>
            <div>Elevation: ${seat.elevation}</div>
            ${seat.url ? `<div style="margin-top: 10px;"><a href="${seat.url}" style="background: #006BB6; color: white; padding: 8px 15px; text-decoration: none; border-radius: 4px; display: inline-block;">View Tickets</a></div>` : ''}
          </div>
        `;
      }

      gamesHTML += `
        <div style="margin: 30px 0; padding: 20px; border: 2px solid #006BB6; border-radius: 8px;">
          <h2 style="color: #F58426; margin-top: 0;">vs ${rec.game.opponent}</h2>
          <p style="font-size: 16px; color: #666;">${formattedDate}</p>
          <p style="color: #888;">${rec.game.venue}</p>
          <h3 style="color: #006BB6;">Recommended Seats:</h3>
          ${seatsHTML}
        </div>
      `;
    }

    return `
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px;">
            <h1 style="color: #006BB6; border-bottom: 3px solid #F58426; padding-bottom: 10px;">
              🏀 Your Knicks Seat Recommendations
            </h1>
            <p style="font-size: 16px; color: #333;">
              Based on your preferences, here are the best upcoming games and seats:
            </p>
            ${gamesHTML}
            <div style="margin-top: 30px; padding: 15px; background: #f0f8ff; border-radius: 5px;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                <strong>Note:</strong> Prices and availability are subject to change.
                These recommendations are based on your saved preferences.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content
   * @param {Array} recommendations - Game and ticket recommendations
   * @returns {string} Plain text content
   */
  generateEmailText(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return 'No games found matching your preferences in the next 60 days.\nCheck back next month!';
    }

    let text = '🏀 KNICKS SEAT RECOMMENDATIONS\n\n';

    for (const rec of recommendations) {
      const gameDate = new Date(rec.game.date);
      text += `\n${'='.repeat(50)}\n`;
      text += `VS ${rec.game.opponent.toUpperCase()}\n`;
      text += `${gameDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}\n`;
      text += `${rec.game.venue}\n`;
      text += `${'='.repeat(50)}\n\n`;

      const topSeats = rec.bestSeats.slice(0, 3);
      for (let i = 0; i < topSeats.length; i++) {
        const seat = topSeats[i];
        const badge = i === 0 ? '⭐ BEST MATCH' : `#${i + 1}`;
        text += `${badge}\n`;
        text += `Section ${seat.section}, Row ${seat.row}\n`;
        text += `Seats: ${seat.seats.join(', ')} ${seat.isAisle ? '(Aisle)' : ''}\n`;
        text += `Price: $${seat.price}/seat (Total: $${seat.totalCost})\n`;
        text += `Match Score: ${seat.score}/100\n`;
        text += `Elevation: ${seat.elevation}\n`;
        if (seat.url) {
          text += `Link: ${seat.url}\n`;
        }
        text += `\n`;
      }
    }

    return text;
  }

  /**
   * Get current month and year
   * @returns {string} Month Year format
   */
  getMonthYear() {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  /**
   * Send test email
   * @param {string} recipient - Test recipient email
   * @returns {Promise<Object>} Send result
   */
  async sendTestEmail(recipient) {
    const mailOptions = {
      from: `"Knicks Seat Selector" <${this.config.email}>`,
      to: recipient,
      subject: '🏀 Test Email - Knicks Seat Selector',
      text: 'This is a test email from your Knicks Seat Selector. If you received this, your email configuration is working!',
      html: '<p>This is a test email from your <strong>Knicks Seat Selector</strong>.</p><p>If you received this, your email configuration is working! 🎉</p>'
    };

    return await this.transporter.sendMail(mailOptions);
  }
}

module.exports = EmailService;
