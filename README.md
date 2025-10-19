# Knicks Seat Selector

An automated tool that finds the best Knicks tickets based on your preferences and sends monthly email recommendations with live ticket data from SeatGeek.

## Features

- **Live Ticket API Integration**: Fetches real-time ticket availability from SeatGeek
- **Smart Seat Scoring**: Automatically ranks seats based on your preferences
- **Monthly Email Recommendations**: Scheduled emails with top seat picks for upcoming games
- **Customizable Preferences**: Configure budget, location, view, and opponent preferences
- **Beautiful HTML Emails**: Professionally formatted recommendations with direct ticket links

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Your API Keys

#### SeatGeek API Key
1. Visit https://seatgeek.com/account/develop
2. Sign up or log in
3. Create an application to get your Client ID
4. Copy your Client ID (this is your API key)

#### Gmail App Password (for email notifications)
1. Enable 2-factor authentication on your Google account
2. Visit https://myaccount.google.com/apppasswords
3. Create a new app password for "Mail"
4. Copy the 16-character password

### 3. Configure the Application

```bash
# Copy the example config file
cp config.example.yaml config.yaml
```

Edit `config.yaml` and add your credentials:

```yaml
seatgeek:
  api_key: "YOUR_SEATGEEK_CLIENT_ID"

email:
  service: "gmail"
  email: "your-email@gmail.com"
  password: "your-16-char-app-password"
```

### 4. Update Email Addresses

Edit `preferences.yaml` and add your actual email addresses:

```yaml
users:
  - name: "Matt Diaz"
    email: "your-actual-email@gmail.com"
  - name: "Daniel"
    email: "daniels-email@gmail.com"
```

## Usage

### Run Immediate Recommendation

Get recommendations for upcoming games right now:

```bash
npm run recommend
```

### Test Email Configuration

Verify your email setup is working:

```bash
npm run test-email
```

Or send to a specific email:

```bash
node scheduler.js test-email your-email@example.com
```

### Schedule Monthly Emails

Start the scheduler to automatically send recommendations on the 1st of each month at 9:00 AM:

```bash
npm run schedule
```

The scheduler will keep running in the background. To run it persistently, consider using:
- **PM2**: `pm2 start scheduler.js -- schedule`
- **systemd** (Linux): Create a service file
- **Windows Task Scheduler**: Schedule to run at startup
- **Docker**: Create a container with the scheduler

## Configuration

### Seat Preferences (`preferences.yaml`)

Configure your ideal seats:

```yaml
preferences:
  budget:
    max_per_seat: 400    # Maximum price per seat
    total_max: 600       # Maximum total for both seats
    min_per_seat: 200    # Minimum price (premium only)

  location:
    max_row: 20          # Don't sit higher than row 20
    aisle_seats: "strongly_preferred"
    together: true       # Must be adjacent seats

  view:
    center_court_preference: "preferred"
    avoid_corners: true
    min_elevation: "lower"  # Only lower bowl sections

  games:
    preferred_opponents:
      - "Celtics"
      - "Lakers"
      - "Warriors"
```

### Email Schedule (`config.yaml`)

Customize when emails are sent using cron format:

```yaml
scheduler:
  # Format: minute hour day-of-month month day-of-week
  cron: "0 9 1 * *"  # 9:00 AM on the 1st of every month
```

**Common schedules:**
- Weekly (Monday 9 AM): `"0 9 * * 1"`
- Bi-weekly (1st & 15th): `"0 9 1,15 * *"`
- Daily: `"0 9 * * *"`

## How It Works

1. **Fetch Games**: Queries SeatGeek API for upcoming Knicks home games
2. **Get Tickets**: Retrieves available ticket listings for each game
3. **Score Seats**: Ranks each seat based on your preferences:
   - Budget compliance (required)
   - Section location (center court vs corners)
   - Row preference
   - Aisle seats
   - Price value ratio
4. **Send Email**: Generates beautiful HTML email with top 3 recommendations per game
5. **Direct Links**: Each recommendation includes a link to purchase on SeatGeek

## Project Structure

```
knicks-seat-selector/
├── seatSelector.js      # Core seat scoring logic
├── ticketAPI.js         # SeatGeek API integration
├── emailService.js      # Email generation and sending
├── scheduler.js         # Monthly automation scheduler
├── preferences.yaml     # Your seat preferences
├── config.yaml          # API keys and email settings (not committed)
├── config.example.yaml  # Template for configuration
└── README.md           # This file
```

## Example Email Output

Your monthly email will include:

```
🏀 Your Knicks Seat Recommendations

VS BOSTON CELTICS
Friday, March 15, 2024 at 7:30 PM
Madison Square Garden

⭐ BEST MATCH
Section 115, Row 12
Seats: 1, 2 (Aisle)
$380/seat (Total: $760)
Match Score: 95/100
Elevation: lower
[View Tickets →]

#2
Section 109, Row 15
Seats: 8, 9
$350/seat (Total: $700)
Match Score: 88/100
...
```

## Troubleshooting

### Email Not Sending

- **Gmail**: Make sure you're using an App Password, not your regular password
- **2FA Required**: Gmail requires 2-factor authentication enabled
- **Less Secure Apps**: Don't use this option, use App Passwords instead

### No Recommendations Found

- Check your SeatGeek API key is valid
- Verify your budget constraints aren't too restrictive
- Try expanding your `max_row` or relaxing other preferences
- Make sure there are upcoming home games (check SeatGeek.com)

### API Rate Limits

SeatGeek free tier limits:
- 5,000 requests per day
- Should be plenty for monthly emails
- Each run uses ~5-10 requests

## Advanced Usage

### Running in Production

For continuous operation, use a process manager:

```bash
# Install PM2
npm install -g pm2

# Start scheduler
pm2 start scheduler.js --name knicks-seats -- schedule

# View logs
pm2 logs knicks-seats

# Auto-restart on boot
pm2 startup
pm2 save
```

### Custom Email Templates

Edit `emailService.js` to customize the HTML template in the `generateEmailHTML()` method.

### Multiple Users

Add more users to `preferences.yaml`:

```yaml
users:
  - name: "Person 1"
    email: "person1@example.com"
  - name: "Person 2"
    email: "person2@example.com"
  - name: "Person 3"
    email: "person3@example.com"
```

All users will receive the same recommendations.

## API Documentation

- **SeatGeek API**: https://platform.seatgeek.com/
- **Nodemailer**: https://nodemailer.com/
- **node-cron**: https://github.com/node-cron/node-cron

## Contributing

Feel free to submit issues or pull requests!

## License

MIT
