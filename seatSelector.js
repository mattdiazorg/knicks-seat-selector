#!/usr/bin/env node

/**
 * Knicks Seat Selection Tool
 * Selects optimal seats based on preferences defined in preferences.yaml
 */

const fs = require('fs');
const yaml = require('js-yaml');

class KnicksSeatSelector {
  constructor(preferencesPath = './preferences.yaml') {
    this.preferences = this.loadPreferences(preferencesPath);
    this.msgSeats = this.getMSGSeatingMap();
  }

  loadPreferences(path) {
    try {
      const fileContents = fs.readFileSync(path, 'utf8');
      return yaml.load(fileContents);
    } catch (e) {
      console.error('Error loading preferences:', e.message);
      process.exit(1);
    }
  }

  getMSGSeatingMap() {
    // Madison Square Garden seating sections
    return {
      courtside: {
        sections: ['Floor A', 'Floor B', 'Floor C', 'Floor D'],
        priceRange: [800, 3000],
        elevation: 'courtside'
      },
      lower100s: {
        sections: Array.from({length: 27}, (_, i) => (101 + i).toString()),
        priceRange: [200, 800],
        elevation: 'lower',
        center: ['107', '108', '109', '110', '111', '112', '113', '114', '115', '116'],
        corners: ['101', '102', '103', '125', '126', '127']
      },
      bridge: {
        sections: Array.from({length: 9}, (_, i) => (1 + i).toString()),
        priceRange: [150, 400],
        elevation: 'bridge',
        center: ['4', '5', '6']
      },
      upper200s: {
        sections: Array.from({length: 31}, (_, i) => (201 + i).toString()),
        priceRange: [50, 200],
        elevation: 'upper',
        center: ['210', '211', '212', '213', '214', '215', '216', '217'],
        corners: ['201', '202', '203', '229', '230', '231']
      }
    };
  }

  scoreSection(section, seatInfo, sectionType) {
    let score = 100;
    const prefs = this.preferences.preferences;

    // Price check (hard constraint)
    if (seatInfo.price > prefs.budget.max_per_seat ||
        seatInfo.price < prefs.budget.min_per_seat) {
      return 0;
    }

    // Elevation preference
    const elevationPref = prefs.view.min_elevation;
    const elevationScore = {
      courtside: 4,
      lower: 3,
      bridge: 2,
      upper: 1
    };

    if (elevationScore[sectionType.elevation] < elevationScore[elevationPref]) {
      return 0;
    }

    // Center court preference
    if (sectionType.center && sectionType.center.includes(section)) {
      score += 30;
    }

    // Avoid corners
    if (prefs.view.avoid_corners && sectionType.corners &&
        sectionType.corners.includes(section)) {
      score -= 40;
    }

    // Row preference
    if (seatInfo.row && seatInfo.row <= prefs.location.max_row) {
      score += 20;
    }

    // Aisle seats
    if (prefs.location.aisle_seats && seatInfo.isAisle) {
      score += 15;
    }

    // Price value (lower price gets bonus)
    const priceRatio = seatInfo.price / prefs.budget.max_per_seat;
    score += (1 - priceRatio) * 20;

    return score;
  }

  findBestSeats(availableSeats) {
    /**
     * Find the best seats from available inventory
     * @param {Array} availableSeats - Array of seat objects with properties:
     *   { section, row, seats: [number], price, isAisle }
     * @returns {Object} Best seat recommendation
     */

    const prefs = this.preferences.preferences;
    let bestOption = null;
    let bestScore = 0;

    for (const seatOption of availableSeats) {
      // Check if seats are together
      if (prefs.location.together && seatOption.seats.length < 2) {
        continue;
      }

      // Check total budget
      const totalCost = seatOption.price * seatOption.seats.length;
      if (totalCost > prefs.budget.total_max) {
        continue;
      }

      // Find section type
      let sectionType = null;
      for (const [type, info] of Object.entries(this.msgSeats)) {
        if (info.sections.includes(seatOption.section)) {
          sectionType = info;
          break;
        }
      }

      if (!sectionType) continue;

      const score = this.scoreSection(
        seatOption.section,
        seatOption,
        sectionType
      );

      if (score > bestScore) {
        bestScore = score;
        bestOption = {
          ...seatOption,
          score,
          totalCost,
          elevation: sectionType.elevation
        };
      }
    }

    return bestOption;
  }

  generateReport(recommendation) {
    console.log('\n=== KNICKS SEAT RECOMMENDATION ===\n');
    console.log(`Users: ${this.preferences.users.map(u => u.name).join(' & ')}\n`);

    if (!recommendation) {
      console.log('No seats found matching your preferences.');
      console.log('Try adjusting your budget or location preferences.');
      return;
    }

    console.log(`Section: ${recommendation.section}`);
    console.log(`Row: ${recommendation.row}`);
    console.log(`Seats: ${recommendation.seats.join(', ')}`);
    console.log(`Price per seat: $${recommendation.price}`);
    console.log(`Total cost: $${recommendation.totalCost}`);
    console.log(`Elevation: ${recommendation.elevation}`);
    console.log(`Aisle seats: ${recommendation.isAisle ? 'Yes' : 'No'}`);
    console.log(`\nMatch score: ${recommendation.score}/100`);
    console.log('\n================================\n');
  }
}

// Example usage
if (require.main === module) {
  const selector = new KnicksSeatSelector();

  // Example available seats (this would come from ticket API in production)
  const exampleSeats = [
    { section: '109', row: 8, seats: [5, 6], price: 450, isAisle: false },
    { section: '115', row: 12, seats: [1, 2], price: 380, isAisle: true },
    { section: '5', row: 3, seats: [8, 9], price: 250, isAisle: false },
    { section: '212', row: 5, seats: [15, 16], price: 120, isAisle: true },
    { section: '101', row: 15, seats: [3, 4], price: 300, isAisle: false },
    { section: '227', row: 8, seats: [10, 11], price: 85, isAisle: false }
  ];

  console.log('Processing available seats against your preferences...');
  const recommendation = selector.findBestSeats(exampleSeats);
  selector.generateReport(recommendation);
}

module.exports = KnicksSeatSelector;
