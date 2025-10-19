/**
 * Ticket API Integration
 * Fetches live ticket data from SeatGeek API
 */

const https = require('https');

class TicketAPI {
  constructor(config) {
    // Support both old format (just client_id) and new format (client_id + client_secret)
    if (typeof config === 'string') {
      this.clientId = config;
      this.clientSecret = '';
    } else {
      this.clientId = config.client_id;
      this.clientSecret = config.client_secret || '';
    }
    this.baseUrl = 'api.seatgeek.com';
  }

  /**
   * Fetch upcoming Knicks home games
   * @returns {Promise<Array>} List of upcoming games
   */
  async getUpcomingGames() {
    const path = `/2/events?performers.slug=new-york-knicks&venue.city=New+York&per_page=25${this.getAuthParams(false)}`;

    try {
      const data = await this.makeRequest(path);
      return data.events || [];
    } catch (error) {
      console.error('Error fetching games:', error.message);
      throw error;
    }
  }

  /**
   * Fetch available tickets for a specific event
   * @param {string} eventId - SeatGeek event ID
   * @returns {Promise<Array>} List of available tickets
   */
  async getTicketsForEvent(eventId) {
    const path = `/2/events/${eventId}${this.getAuthParams(true)}`;

    try {
      const data = await this.makeRequest(path);

      // Transform SeatGeek data to our format
      const tickets = [];

      if (data.stats && data.stats.listing_count > 0) {
        // Get ticket listings
        const listingsPath = `/2/events/${eventId}/listings${this.getAuthParams(true)}&per_page=100`;
        const listingsData = await this.makeRequest(listingsPath);

        if (listingsData.listings) {
          for (const listing of listingsData.listings) {
            tickets.push(this.transformListing(listing));
          }
        }
      }

      return tickets;
    } catch (error) {
      console.error('Error fetching tickets:', error.message);
      throw error;
    }
  }

  /**
   * Transform SeatGeek listing to our seat format
   * @param {Object} listing - SeatGeek listing object
   * @returns {Object} Transformed seat object
   */
  transformListing(listing) {
    // Extract section and row
    const section = listing.section || 'Unknown';
    const row = listing.row ? parseInt(listing.row) || 1 : 1;

    // Generate seat numbers based on quantity
    const seats = Array.from(
      { length: listing.quantity || 2 },
      (_, i) => (listing.seat_number || 1) + i
    );

    // Determine if aisle seats (SeatGeek doesn't always provide this)
    const isAisle = listing.seat_number === 1 ||
                    (listing.split_type && listing.split_type.includes('aisle'));

    return {
      section: section.toString(),
      row: row,
      seats: seats,
      price: Math.round(listing.price),
      isAisle: isAisle,
      listingId: listing.id,
      url: listing.url || `https://seatgeek.com/listing/${listing.id}`
    };
  }

  /**
   * Get recommended tickets for upcoming games
   * @param {number} daysAhead - How many days ahead to look
   * @returns {Promise<Object>} Games with available tickets
   */
  async getUpcomingRecommendations(daysAhead = 60) {
    const games = await this.getUpcomingGames();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    const upcomingGames = games.filter(game => {
      const gameDate = new Date(game.datetime_local);
      return gameDate <= cutoffDate && gameDate > new Date();
    });

    const recommendations = [];

    // Get tickets for up to 5 upcoming games
    for (const game of upcomingGames.slice(0, 5)) {
      try {
        const tickets = await this.getTicketsForEvent(game.id);

        if (tickets.length > 0) {
          recommendations.push({
            game: {
              id: game.id,
              title: game.title,
              date: game.datetime_local,
              opponent: this.extractOpponent(game.title),
              venue: game.venue.name
            },
            tickets: tickets
          });
        }
      } catch (error) {
        console.error(`Error fetching tickets for game ${game.id}:`, error.message);
      }
    }

    return recommendations;
  }

  /**
   * Extract opponent from game title
   * @param {string} title - Game title
   * @returns {string} Opponent name
   */
  extractOpponent(title) {
    // Title format: "New York Knicks at/vs Opponent"
    const parts = title.split(/ at | vs /);
    return parts.length > 1 ? parts[1] : title;
  }

  /**
   * Get authentication query parameters
   * @param {boolean} firstParam - Whether this is the first query parameter
   * @returns {string} Query string with client_id and client_secret
   */
  getAuthParams(firstParam = true) {
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    if (this.clientSecret) {
      params.append('client_secret', this.clientSecret);
    }
    return (firstParam ? '?' : '&') + params.toString();
  }

  /**
   * Make HTTPS request to SeatGeek API
   * @param {string} path - API path
   * @returns {Promise<Object>} Response data
   */
  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }
}

module.exports = TicketAPI;
