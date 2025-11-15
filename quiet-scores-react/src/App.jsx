import { useEffect, useMemo, useRef, useState } from 'react'
import { useScores } from './hooks/useScores'
import { fetchGameSummary } from './lib/espnApi'

const SPORT_BUTTONS = [
  { label: 'All Sports', value: 'all' },
  { label: 'NFL', value: 'nfl' },
  { label: 'NBA', value: 'nba' },
  { label: 'MLB', value: 'mlb' },
  { label: 'NHL', value: 'nhl' },
  { label: 'CFB', value: 'college-football' },
  { label: 'CBB', value: 'college-basketball' },
]

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const JS_DAY_TO_KEY = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const MILLISECONDS_IN_DAY = 86_400_000

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getMonday(date) {
  const jsDay = date.getDay()
  const diff = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return stripTime(monday)
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatWeekLabel(offset) {
  if (offset === 0) return 'Current Week'
  const abs = Math.abs(offset)
  const suffix = abs === 1 ? 'Week' : 'Weeks'
  return offset > 0 ? `${abs} ${suffix} Ahead` : `${abs} ${suffix} Ago`
}

function formatDateLabel(date) {
  if (!date) return '-'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDayKeyFromDate(date) {
  return JS_DAY_TO_KEY[date.getDay()]
}

function getSportDisplayName(sport) {
  switch (sport) {
    case 'nfl':
      return 'NFL'
    case 'nba':
      return 'NBA'
    case 'mlb':
      return 'MLB'
    case 'nhl':
      return 'NHL'
    case 'college-football':
      return 'CFB'
    case 'college-basketball':
      return 'CBB'
    default:
      return sport?.toUpperCase() ?? 'SPORT'
  }
}

function getTeamInitials(teamName) {
  if (!teamName) return '?'
  const cleaned = teamName.trim()
  if (cleaned.length <= 4 && !cleaned.includes(' ')) {
    return cleaned.toUpperCase()
  }
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return (
    words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase()
  )
}

function getFallbackText(fullName, shortName, abbreviation) {
  if (abbreviation) return abbreviation.toUpperCase()
  if (shortName) return getTeamInitials(shortName)
  return getTeamInitials(fullName)
}

function getWinner(game) {
  const awayScore = Number(game.awayScore)
  const homeScore = Number(game.homeScore)
  if (Number.isNaN(awayScore) || Number.isNaN(homeScore)) return null
  if (awayScore === homeScore) return null
  return awayScore > homeScore ? 'away' : 'home'
}

function getInningDisplay(game) {
  if (game.sport !== 'mlb' || !game.inningNumber) return ''
  
  const inningText = game.inningNumber === 1 ? '1st' :
                     game.inningNumber === 2 ? '2nd' :
                     game.inningNumber === 3 ? '3rd' :
                     `${game.inningNumber}th`
  
  let inningState = ''
  if (game.topBottom === 'top') {
    inningState = 'Top'
  } else if (game.topBottom === 'bot' || game.topBottom === 'bottom') {
    inningState = 'Bot'
  } else if (game.topBottom === 'mid' || game.topBottom === 'middle') {
    inningState = 'Mid'
  } else if (game.topBottom === 'end') {
    inningState = 'End'
  }
  
  return inningState ? `${inningState} ${inningText}` : ''
}

function getStatusBadge(game) {
  const timeText = game.time || ''
  
  // For MLB live games, show inning display
  if (game.sport === 'mlb' && game.status === 'live' && game.inningNumber) {
    const inningDisplay = getInningDisplay(game)
    if (inningDisplay) {
      return { className: 'inning-display live', text: inningDisplay }
    }
  }
  
  switch (game.status) {
    case 'live':
      return { className: 'inning-display live', text: timeText || 'Live' }
    case 'halftime':
      return { className: 'inning-display halftime', text: 'HALFTIME' }
    case 'final':
      if (game.sport === 'mlb') {
        return { className: 'inning-display final', text: 'FINAL' }
      }
      return { className: 'inning-display final', text: 'FINAL' }
    case 'postponed':
      return { className: 'inning-display scheduled', text: 'POSTPONED' }
    default:
      return {
        className: 'inning-display scheduled',
        text: game.displayTime || timeText || 'TBD',
      }
  }
}

function BasesVisual({ bases }) {
  if (!bases || bases === 'empty') return null
  
  const secondBase = bases === '2nd' || bases === '1st & 2nd' || bases === '2nd & 3rd' || bases === 'loaded'
  const firstBase = bases === '1st' || bases === '1st & 2nd' || bases === '1st & 3rd' || bases === 'loaded'
  const thirdBase = bases === '3rd' || bases === '1st & 3rd' || bases === '2nd & 3rd' || bases === 'loaded'
  
  return (
    <div className="bases-diamond">
      <div className={`base second-base ${secondBase ? 'occupied' : 'empty'}`}></div>
      <div className="bases-row">
        <div className={`base third-base ${thirdBase ? 'occupied' : 'empty'}`}></div>
        <div className={`base first-base ${firstBase ? 'occupied' : 'empty'}`}></div>
      </div>
    </div>
  )
}

function CountDots({ game }) {
  if (game.sport !== 'mlb') return null
  
  return (
    <div className="count-dots-container">
      {game.balls !== null && game.balls !== undefined && (
        <div className="count-dots balls-dots">
          <span className="count-label">B</span>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`count-dot ${i < game.balls ? 'active' : ''}`}>●</span>
          ))}
        </div>
      )}
      {game.strikes !== null && game.strikes !== undefined && (
        <div className="count-dots strikes-dots">
          <span className="count-label">S</span>
          {[0, 1].map((i) => (
            <span key={i} className={`count-dot ${i < game.strikes ? 'active' : ''}`}>●</span>
          ))}
        </div>
      )}
      {game.outs !== null && game.outs !== undefined && (
        <div className="count-dots outs-dots">
          <span className="count-label">O</span>
          {[0, 1].map((i) => (
            <span key={i} className={`count-dot ${i < game.outs ? 'active' : ''}`}>●</span>
          ))}
        </div>
      )}
    </div>
  )
}


function TeamLogo({ name, logoUrl, fallbackText }) {
  const [failed, setFailed] = useState(false)
  const fallback = fallbackText || getTeamInitials(name)

  if (!logoUrl || failed) {
    return (
      <div className="fallback-logo">
        {fallback}
      </div>
    )
  }

  return (
    <>
      <img
        src={logoUrl}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'contain' }}
      />
      <div className="fallback-logo" style={{ display: 'none' }}>
        {fallback}
      </div>
    </>
  )
}

function TeamRow({ game, side }) {
  const isAway = side === 'away'
  const teamName = isAway ? game.awayTeam : game.homeTeam
  const teamShortName = isAway ? game.awayShortName : game.homeShortName
  const teamAbbreviation = isAway ? game.awayAbbreviation : game.homeAbbreviation
  const score = isAway ? game.awayScore : game.homeScore
  const record = isAway ? game.awayTeamRecord : game.homeTeamRecord
  const isWinner = getWinner(game) === side
  const scheduled = game.status === 'scheduled'
  const logoUrl = isAway ? game.awayLogo : game.homeLogo
  const displayName = teamShortName || teamName
  const fallbackText = getFallbackText(teamName, teamShortName, teamAbbreviation)

  // Check for possession/at-bat highlighting
  let hasPossession = false
  if (game.status === 'live' || game.status === 'halftime') {
    if (game.sport === 'nfl' || game.sport === 'college-football') {
      const teamId = isAway ? game.awayTeamId : game.homeTeamId
      hasPossession = game.possessionTeam && teamId && game.possessionTeam === teamId
    } else if (game.sport === 'mlb') {
      hasPossession = game.atBatTeam === side
    }
  }

  const classes = ['team']
  if (isWinner && game.status === 'final') classes.push('winner')
  if (hasPossession) classes.push('possession')
  if (hasPossession && game.sport === 'mlb') classes.push('at-bat')

  // Get odds for this team
  let teamSpread = null
  let teamMoneyline = null
  if (scheduled && game.odds) {
    if (isAway) {
      teamSpread = game.odds.spread
      teamMoneyline = game.odds.awayMoneyline
    } else {
      // Home team spread is opposite of away
      teamSpread = game.odds.spread !== null ? -game.odds.spread : null
      teamMoneyline = game.odds.homeMoneyline
    }
  }

  const formatSpread = (spread) => {
    if (spread === null || spread === undefined) return null
    const num = typeof spread === 'string' ? parseFloat(spread.replace('+', '')) : spread
    if (isNaN(num)) return String(spread)
    return num > 0 ? `+${num}` : String(num)
  }

  const formatMoneyline = (ml) => {
    if (ml === null || ml === undefined) return null
    const num = typeof ml === 'string' ? parseFloat(ml.replace('+', '')) : ml
    if (isNaN(num)) return String(ml)
    return num > 0 ? `+${num}` : String(num)
  }

  return (
    <div className={classes.filter(Boolean).join(' ')}>
      <div className="team-info">
        <div className="team-logo">
          <TeamLogo name={teamName} logoUrl={logoUrl} fallbackText={fallbackText} />
        </div>
        <div className="team-details">
          <span className="team-name">
            {displayName}
            {scheduled && teamSpread !== null && (
              <span className="team-spread"> ({formatSpread(teamSpread)})</span>
            )}
            {scheduled && teamMoneyline !== null && (
              <span className="team-moneyline"> {formatMoneyline(teamMoneyline)}</span>
            )}
          </span>
          {record ? <span className="team-record">{record}</span> : null}
        </div>
      </div>
      <span className={['team-score', scheduled ? 'scheduled' : ''].join(' ')}>
        {scheduled ? '' : score}
      </span>
    </div>
  )
}

function ScoreCard({ game, onOpenSummary }) {
  const badge = getStatusBadge(game)
  const statusBadge = badge ? (
    <span className={badge.className}>{badge.text}</span>
  ) : null

  return (
    <div
      className="score-card"
      data-game-id={`${game.sport}-${game.awayTeam}-${game.homeTeam}`}
      onClick={() => onOpenSummary(game)}
    >
      <div className="game-header">
        <span className="sport-type">
          {getSportDisplayName(game.sport)}
          {game.broadcastChannel ? ` • ${game.broadcastChannel}` : ''}
        </span>
        {statusBadge}
      </div>
      <div className="game-content">
        <div className="teams">
          <TeamRow game={game} side="away" />
          {game.status === 'scheduled' && game.odds?.overUnder !== null && (
            <div className="over-under-display">
              O/U: {game.odds.overUnder}
            </div>
          )}
          <TeamRow game={game} side="home" />
        </div>
        {game.sport === 'mlb' && game.status === 'live' && (
          <div className="mlb-game-state live-game">
            <div className="mlb-bases-container">
              <BasesVisual bases={game.bases} />
            </div>
            <div className="mlb-count-container">
              <CountDots game={game} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_ORDER = {
  live: 0,
  halftime: 1,
  scheduled: 2,
  postponed: 3,
  final: 4,
}

function compareGames(a, b) {
  const statusDiff = (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)
  if (statusDiff !== 0) return statusDiff

  const timeA = a.fullDateTime ? new Date(a.fullDateTime).getTime() : Number.MAX_SAFE_INTEGER
  const timeB = b.fullDateTime ? new Date(b.fullDateTime).getTime() : Number.MAX_SAFE_INTEGER
  if (timeA !== timeB) return timeA - timeB

  const sportDiff = a.sport.localeCompare(b.sport)
  if (sportDiff !== 0) return sportDiff

  return a.homeTeam.localeCompare(b.homeTeam)
}

function GameSummary({ game, onBack }) {
  const [summaryData, setSummaryData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      if (!game?.id || !game?.sport) return

      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchGameSummary(game.sport, game.id)
        if (!cancelled) {
          setSummaryData(data)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load game summary:', err)
          setError(err.message)
          setIsLoading(false)
        }
      }
    }

    loadSummary()

    return () => {
      cancelled = true
    }
  }, [game?.id, game?.sport])

  const boxscore = summaryData?.boxscore
  const teams = boxscore?.teams || []
  // Try to match teams by ID first, then by position (away is usually first, home second)
  const awayTeam = teams.find((t) => {
    const teamId = String(t.team?.id || '')
    return teamId === String(game.awayTeamId) || 
           t.team?.displayName === game.awayTeam ||
           t.team?.name === game.awayTeam
  }) || teams[0]
  const homeTeam = teams.find((t) => {
    const teamId = String(t.team?.id || '')
    return teamId === String(game.homeTeamId) ||
           t.team?.displayName === game.homeTeam ||
           t.team?.name === game.homeTeam
  }) || teams[1] || (teams[0] === awayTeam ? null : teams[0])
  const plays = summaryData?.plays || []
  const headlines = summaryData?.headlines || []
  const commentary = summaryData?.commentary || []
  
  // Extract player stats and leaders
  const leaders = summaryData?.leaders || boxscore?.leaders || []
  const awayPlayers = awayTeam?.statistics?.[0]?.athletes || awayTeam?.players || []
  const homePlayers = homeTeam?.statistics?.[0]?.athletes || homeTeam?.players || []
  
  // Get top performers by category
  const getTopPlayers = (category) => {
    const categoryLeaders = leaders.find((l) => l.name === category || l.displayName === category)
    if (!categoryLeaders) return null
    
    const awayLeader = categoryLeaders.leaders?.find((l) => l.team?.id === awayTeam?.team?.id)
    const homeLeader = categoryLeaders.leaders?.find((l) => l.team?.id === homeTeam?.team?.id)
    
    return { away: awayLeader, home: homeLeader, category: categoryLeaders.displayName || categoryLeaders.name }
  }

  return (
    <div className="container">
      <div className="site-header">
        <div className="header-left">
          <img src="helmet logo.png" alt="Quiet Scores Logo" className="site-logo" />
          <h1>Game Summary</h1>
        </div>
        <button className="back-btn" onClick={onBack}>
          ← Back to Scores
        </button>
      </div>

      <div className="game-summary-content">
        {isLoading && <div className="info">Loading game summary...</div>}
        {error && <div className="error">Error loading summary: {error}</div>}
        {summaryData && (
          <div>
            {/* Game Header */}
            <div className="game-info-header">
              <div className="game-teams-header">
                <div className="team-header">
                  <div className="team-name-large">{game.awayTeam}</div>
                  <div className="team-score-large">{game.awayScore || '-'}</div>
                </div>
                <div className="vs-divider">@</div>
                <div className="team-header">
                  <div className="team-name-large">{game.homeTeam}</div>
                  <div className="team-score-large">{game.homeScore || '-'}</div>
                </div>
              </div>
              <div className="game-status-badge">
                <span className="sport-badge">{getSportDisplayName(game.sport)}</span>
                <span className="status-text">{game.status === 'live' ? 'LIVE' : game.status === 'final' ? 'FINAL' : 'SCHEDULED'}</span>
              </div>
            </div>

            {/* Box Score */}
            {boxscore && awayTeam && homeTeam && (
              <div className="summary-section">
                <h3>Box Score</h3>
                <div className="boxscore-container">
                  <table className="boxscore-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{awayTeam.team?.displayName || awayTeam.team?.name || game.awayTeam}</th>
                        <th>{homeTeam.team?.displayName || homeTeam.team?.name || game.homeTeam}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awayTeam.statistics && homeTeam.statistics && awayTeam.statistics.map((stat, idx) => {
                        const homeStat = homeTeam.statistics[idx]
                        if (!stat || !homeStat) return null
                        return (
                          <tr key={idx}>
                            <td className="stat-label">{stat.label || stat.name}</td>
                            <td>{stat.displayValue || stat.value || '-'}</td>
                            <td>{homeStat.displayValue || homeStat.value || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top Player Stats */}
            {leaders.length > 0 && (
              <div className="summary-section">
                <h3>Top Performers</h3>
                <div className="leaders-grid">
                  {leaders.slice(0, 6).map((leader, idx) => {
                    const topLeaders = leader.leaders || []
                    if (topLeaders.length === 0) return null
                    
                    return (
                      <div key={idx} className="leader-category">
                        <div className="leader-category-name">
                          {leader.displayName || leader.name || 'Stat'}
                        </div>
                        <div className="leader-players">
                          {topLeaders.slice(0, 3).map((player, pIdx) => (
                            <div key={pIdx} className="leader-player">
                              <div className="leader-player-name">
                                {player.athlete?.displayName || player.athlete?.fullName || player.displayName || 'Player'}
                              </div>
                              <div className="leader-player-stat">
                                {player.displayValue || player.value || '-'}
                              </div>
                              <div className="leader-player-team">
                                {player.team?.displayName || player.team?.abbreviation || ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Scoring Plays */}
            {plays.length > 0 && (
              <div className="summary-section">
                <h3>Scoring Plays</h3>
                <div className="plays-list">
                  {plays
                    .filter((play) => play.scoringPlay || play.type?.text?.includes('Touchdown') || play.type?.text?.includes('Goal'))
                    .slice(-10)
                    .reverse()
                    .map((play, idx) => (
                      <div key={idx} className="play-item">
                        <div className="play-period">
                          {play.period?.displayName || play.period?.number || play.period || '-'}
                        </div>
                        <div className="play-text">
                          {play.text || play.shortText || play.type?.text || play.description || 'Play'}
                        </div>
                        <div className="play-score">
                          {play.awayScore !== undefined && play.homeScore !== undefined
                            ? `${play.awayScore} - ${play.homeScore}`
                            : play.scoreValue || ''}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Game Notes/Commentary */}
            {commentary.length > 0 && (
              <div className="summary-section">
                <h3>Game Notes</h3>
                <div className="game-notes">
                  {commentary.slice(-5).reverse().map((note, idx) => (
                    <div key={idx} className="note-item">
                      <div className="note-time">{note.time}</div>
                      <div className="note-text">{note.text || note.headline}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Headlines */}
            {headlines.length > 0 && (
              <div className="summary-section">
                <h3>Related News</h3>
                <div className="headlines">
                  {headlines.map((headline, idx) => (
                    <div key={idx} className="headline-item">
                      <a
                        href={headline.links?.web?.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="headline-link"
                      >
                        {headline.description || headline.shortLinkText || headline.headline}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  const today = useMemo(() => stripTime(new Date()), [])
  const baseMonday = useMemo(() => getMonday(today), [today])
  const todayKey = useMemo(() => getDayKeyFromDate(today), [today])

  const [weekOffset, setWeekOffset] = useState(0)
  const [activeDay, setActiveDay] = useState(todayKey === 'sunday' ? 'sunday' : todayKey)
  const [currentDate, setCurrentDate] = useState(() => new Date(today))
  const [selectedSport, setSelectedSport] = useState('all')
  const [selectedGame, setSelectedGame] = useState(null)

  const { scores, isLoading, error } = useScores(currentDate)

  const dateInputRef = useRef(null)

  const dayDates = useMemo(() => {
    const monday = addDays(baseMonday, weekOffset * 7)
    const map = {}
    DAY_KEYS.forEach((key, index) => {
      map[key] = addDays(monday, index)
    })
    // Sunday should be six days from Monday
    map.sunday = addDays(monday, 6)
    return map
  }, [baseMonday, weekOffset])

  const handleSportClick = (sport) => {
    setSelectedSport(sport)
  }

  const handleDaySelect = (dayKey) => {
    const targetDate = dayDates[dayKey]
    if (!targetDate) return
    setActiveDay(dayKey)
    setCurrentDate(targetDate)
  }

  const goToWeek = (newOffset) => {
    const monday = addDays(baseMonday, newOffset * 7)
    const defaultDay = newOffset === 0 ? todayKey : 'monday'
    const newActiveDay = DAY_KEYS.includes(defaultDay) ? defaultDay : 'monday'
    const dayIndex = newActiveDay === 'sunday' ? 6 : DAY_KEYS.indexOf(newActiveDay)
    const newDate = addDays(monday, dayIndex)
    setWeekOffset(newOffset)
    setActiveDay(newActiveDay)
    setCurrentDate(newDate)
  }

  const handlePreviousWeek = () => {
    goToWeek(weekOffset - 1)
  }

  const handleNextWeek = () => {
    goToWeek(weekOffset + 1)
  }

  const handleCustomDateChange = (event) => {
    const value = event.target.value
    if (!value) return
    const [year, month, day] = value.split('-').map(Number)
    const selected = new Date(year, month - 1, day)
    const selectedMonday = getMonday(selected)
    const diffWeeks = Math.round((stripTime(selectedMonday) - baseMonday) / MILLISECONDS_IN_DAY / 7)
    setWeekOffset(diffWeeks)
    const newActiveDay = getDayKeyFromDate(selected)
    setActiveDay(DAY_KEYS.includes(newActiveDay) ? newActiveDay : 'monday')
    setCurrentDate(selected)
  }

  const toggleDatePicker = () => {
    if (dateInputRef.current?.showPicker) {
      dateInputRef.current.showPicker()
    } else {
      dateInputRef.current?.click()
    }
  }

  const handleOpenGameSummary = (game) => {
    setSelectedGame(game)
  }

  const handleBackToScores = () => {
    setSelectedGame(null)
  }

  const weekLabel = formatWeekLabel(weekOffset)

  const sortedScores = useMemo(() => {
    const baseScores =
      selectedSport === 'all'
        ? scores
        : scores.filter((game) => game.sport === selectedSport)
    const copy = [...baseScores]
    copy.sort(compareGames)
    return copy
  }, [scores, selectedSport])

  const liveCount = useMemo(
    () => sortedScores.filter((game) => game.status === 'live' || game.status === 'halftime').length,
    [sortedScores],
  )

  // Show game summary if a game is selected
  if (selectedGame) {
    return <GameSummary game={selectedGame} onBack={handleBackToScores} />
  }

  return (
    <div className="container">
      <div className="site-header">
        <div className="header-left">
          <img src="helmet logo.png" alt="Quiet Scores Logo" className="site-logo" />
          <h1>Quiet Scores - Live ESPN Data</h1>
        </div>
        <div
          className="live-games-indicator"
          style={{ display: liveCount > 0 ? 'flex' : 'none' }}
        >
          <span className="count" id="liveGamesCount">
            {liveCount}
          </span>
          <span>Live Games</span>
        </div>
      </div>

      <div className="date-navigation">
        <div className="week-display" onClick={toggleDatePicker} style={{ cursor: 'pointer' }}>
          <div className="week-label" id="weekLabel">
            {weekLabel}
          </div>
        </div>

        <div className="week-buttons">
          <button className="week-nav-btn" onClick={handlePreviousWeek}>
            ◀
          </button>
          {DAY_KEYS.map((dayKey) => (
            <div className="day-button" key={dayKey}>
              <button
                className={['week-btn', activeDay === dayKey ? 'active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleDaySelect(dayKey)}
              >
                {dayKey.slice(0, 3).charAt(0).toUpperCase() + dayKey.slice(1, 3)}
              </button>
              <div className="day-date" id={`${dayKey}Date`}>
                {formatDateLabel(dayDates[dayKey])}
              </div>
            </div>
          ))}
          <button className="week-nav-btn" onClick={handleNextWeek}>
            ▶
          </button>
        </div>

        <div className="date-picker" id="datePicker">
          <input
            ref={dateInputRef}
            type="date"
            id="customDate"
            value={formatDateInputValue(currentDate)}
            onChange={handleCustomDateChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="controls">
        <div className="sport-filters">
          {SPORT_BUTTONS.map((button) => (
            <button
              key={button.value}
              className={['sport-btn', selectedSport === button.value ? 'active' : '']
                .filter(Boolean)
                .join(' ')}
              data-sport={button.value}
              onClick={() => handleSportClick(button.value)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scores-container" id="scoresContainer">
        {error ? (
          <div className="error">Unable to load scores. Please try again.</div>
        ) : sortedScores.length === 0 ? (
          <div className="info">
            {isLoading ? 'Loading scores…' : 'No games scheduled for this date.'}
          </div>
        ) : (
          sortedScores.map((game) => (
            <ScoreCard
              key={game.id ?? `${game.sport}-${game.awayTeam}-${game.homeTeam}`}
              game={game}
              onOpenSummary={handleOpenGameSummary}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default App
