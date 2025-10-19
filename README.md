# Knicks Game Scout

Your monthly guide to the most exciting Knicks games at Madison Square Garden. Get personalized matchup recommendations highlighting must-see games, star players, and team outlooks - all powered by live NBA data.

## Features

- **🔥 Excitement Rankings**: Games rated by matchup quality and star power (1-10 scale)
- **⭐ Star Player Spotlights**: See which elite players are coming to MSG
- **📊 Live Team Data**: Current records, standings, and projections from ESPN API
- **📧 Monthly Email Digest**: Beautiful HTML emails with all upcoming games sorted by excitement
- **🎟️ Direct Ticket Links**: Quick access to StubHub, SeatGeek, and Ticketmaster
- **🎯 Preferred Teams**: Automatically boost excitement for your favorite matchups
- **100% Free**: Uses only free SeatGeek and ESPN APIs

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Your API Keys

#### SeatGeek API (Required - Free)
1. Visit https://seatgeek.com/account/develop
2. Sign up or log in
3. Create an application to get your Client ID and Client Secret
4. Used for fetching Knicks game schedules

#### Gmail App Password (Required - Free)
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
  client_id: "YOUR_SEATGEEK_CLIENT_ID"
  client_secret: "YOUR_SEATGEEK_CLIENT_SECRET"

email:
  service: "gmail"
  email: "your-email@gmail.com"
  password: "your-16-char-app-password"
```

### 4. Update Email Addresses

Edit `preferences.yaml` and add your actual email addresses:

```yaml
users:
  - name: "Your Name"
    id: "you"
    email: "your-email@gmail.com"
  - name: "Friend"
    id: "friend"
    email: "friend@gmail.com"
```

## Usage

### Get Matchup Recommendations Now

See which games are most exciting this month:

```bash
npm run recommend
```

### Test Email Configuration

Verify your email setup is working:

```bash
npm run test-email
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

### Preferred Opponents (`preferences.yaml`)

Tell the system which matchups you're most excited about:

```yaml
preferences:
  games:
    preferred_opponents:
      # Rivalries
      - "Celtics"
      - "Nets"
      - "76ers"
      # Star players / marquee matchups
      - "Lakers"      # LeBron James
      - "Warriors"    # Stephen Curry
      - "Mavericks"   # Luka Doncic
      - "Bucks"       # Giannis
```

Games against these teams get an automatic +1 excitement boost!

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

1. **Fetch Games**: Queries SeatGeek API for upcoming Knicks home games (next 60 days)
2. **Get Team Data**: Pulls live stats, standings, and projections from ESPN API
3. **Rate Excitement**: Each matchup gets a 1-10 rating based on:
   - Star power (LeBron, Giannis, Luka, etc. = 9-10)
   - Team quality (Championship contenders = 8-10)
   - Rivalry factor (Celtics, Nets, 76ers = higher)
   - Your preferred opponents (+1 boost)
4. **Sort by Excitement**: Games ranked from must-see (🔥🔥🔥) to standard matchups
5. **Send Beautiful Email**: HTML email with:
   - Excitement badges (🔥🔥🔥 MUST-SEE, 🔥🔥 PREMIER, 🔥 EXCITING)
   - Star player stats and info
   - Team outlooks and current records
   - Direct links to ticket platforms

## Excitement Rating System

- **10/10**: Generational talents (LeBron, Curry, Giannis, Jokic)
- **9/10**: Elite stars and championship rematches (Celtics, 76ers, Bucks)
- **8/10**: Rising superstars and strong contenders (SGA, Ant Edwards)
- **7/10**: Playoff teams with All-Stars
- **6/10**: Competitive teams, exciting players
- **5/10 and below**: Rebuilding teams, standard matchups

## Project Structure

```
knicks-game-scout/
├── scheduler.js         # Main orchestrator - ranks games and sends emails
├── emailService.js      # Email generation with matchup highlights
├── nbaDataService.js    # ESPN API integration for live team data
├── ticketAPI.js         # SeatGeek API integration for game schedules
├── preferences.yaml     # Your preferred opponents
├── config.yaml          # API keys and email settings (not committed)
├── config.example.yaml  # Template for configuration
└── README.md           # This file
```

## Example Email Output

Your monthly email will look like this:

```
🏀 KNICKS GAME SCOUT
Your Monthly Guide to Must-See Matchups

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥🔥🔥 MUST-SEE GAME

   15        vs Los Angeles Lakers
   DEC       Friday, December 15, 2024 at 7:30 PM
   FRI       Madison Square Garden

Team Outlook
Championship experience. LeBron and AD still elite when healthy.
Record: ~46 wins projected (Current: 18-14)

⭐ Star Players to Watch
• LeBron James - 25.7 PPG, 8.3 APG, 7.3 RPG
• Anthony Davis - 24.7 PPG, 12.6 RPG, 2.3 BPG
• Austin Reaves - 15.9 PPG, 5.5 APG, 4.3 RPG

Find Tickets:
[StubHub] [SeatGeek] [Ticketmaster]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥🔥 PREMIER MATCHUP

   22        vs Boston Celtics
   DEC       Sunday, December 22, 2024 at 3:00 PM
   SUN       Madison Square Garden

Team Outlook
Defending champions looking to repeat. Elite two-way play.
Record: ~58 wins projected (Current: 24-8)

⭐ Star Players to Watch
• Jayson Tatum - 28.4 PPG, 8.6 RPG, 5.7 APG
• Jaylen Brown - 25.7 PPG, 6.2 RPG, 5.1 APG
• Derrick White - 15.1 PPG, 4.2 APG, 4.1 RPG

Find Tickets:
[StubHub] [SeatGeek] [Ticketmaster]

...
```

## Troubleshooting

### Email Not Sending

- **Gmail**: Make sure you're using an App Password, not your regular password
- **2FA Required**: Gmail requires 2-factor authentication enabled
- **Less Secure Apps**: Don't use this option, use App Passwords instead

### No Games Found

- Check your SeatGeek API key is valid
- Make sure there are upcoming home games (check SeatGeek.com)
- Verify the date range (default is next 60 days)

### API Rate Limits

**SeatGeek** (free tier):
- 5,000 requests per day
- Should be plenty for monthly emails
- Each run uses ~5-10 requests

**ESPN API** (free):
- Publicly accessible
- No authentication required
- Reasonable usage expected

## Advanced Usage

### Running in Production

For continuous operation, use a process manager:

```bash
# Install PM2
npm install -g pm2

# Start scheduler
pm2 start scheduler.js --name knicks-scout -- schedule

# View logs
pm2 logs knicks-scout

# Auto-restart on boot
pm2 startup
pm2 save
```

### Custom Email Templates

Edit `emailService.js` to customize the HTML template in the `generateMatchupEmailHTML()` method.

### Multiple Recipients

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

All users will receive the same matchup recommendations.

### Customize Excitement Ratings

Edit the `excitement` ratings in `nbaDataService.js` under `getFallbackTeamData()` to adjust which matchups get highlighted:

```javascript
'Los Angeles Lakers': {
  excitement: 10, // 1-10 scale
  // ... rest of team data
}
```

## API Documentation

- **SeatGeek API**: https://platform.seatgeek.com/
- **ESPN API**: https://site.api.espn.com/apis/site/v2/sports/basketball/nba
- **Nodemailer**: https://nodemailer.com/
- **node-cron**: https://github.com/node-cron/node-cron

## Contributing

Feel free to submit issues or pull requests!

## License

MIT

---

🏀 **Let's Go Knicks!**
