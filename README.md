# Knicks Seat Selector

A tool to help select the best seats at Madison Square Garden for Knicks games based on your personal preferences.

## Features

- Configure seat preferences using a simple YAML file
- Automatic scoring system to rank available seats
- Support for budget constraints, location preferences, and view preferences
- Easy to customize for different games and opponents

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your preferences in `preferences.yaml`

3. Run the tool:
```bash
npm start
```

## Configuration

Edit `preferences.yaml` to set your preferences:

- **Budget**: Set min/max price per seat and total budget
- **Location**: Choose preferred sections, rows, and aisle preferences
- **View**: Set elevation preferences and avoid corners
- **Games**: Filter by opponent or game type

## How It Works

The tool scores each available seat based on your preferences:
- Price within budget (required)
- Elevation level preference
- Center court vs corners
- Row number
- Aisle seats
- Overall value

The highest scoring seats are recommended.

## Example Output

```
=== KNICKS SEAT RECOMMENDATION ===

Users: User 1 & User 2

Section: 115
Row: 12
Seats: 1, 2
Price per seat: $380
Total cost: $760
Elevation: lower
Aisle seats: Yes

Match score: 85/100
```

## Customization

To use with real ticket data:
1. Integrate with a ticket API (StubHub, SeatGeek, etc.)
2. Replace the `exampleSeats` array in `seatSelector.js` with live data
3. Run the tool to get recommendations

## License

MIT
