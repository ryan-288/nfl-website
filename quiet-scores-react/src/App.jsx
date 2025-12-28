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

function abbreviateNetwork(network) {
  if (!network) return ''
  
  const networkLower = network.toLowerCase()
  
  // Common network abbreviations
  const abbreviations = {
    'espn': 'ESPN',
    'espn2': 'ESPN2',
    'espnu': 'ESPNU',
    'espn+': 'ESPN+',
    'abc': 'ABC',
    'cbs': 'CBS',
    'nbc': 'NBC',
    'fox': 'FOX',
    'fs1': 'FS1',
    'fs2': 'FS2',
    'fox sports 1': 'FS1',
    'fox sports 2': 'FS2',
    'sec network': 'SECN',
    'secn': 'SECN',
    'big ten network': 'BTN',
    'btn': 'BTN',
    'acc network': 'ACCN',
    'accn': 'ACCN',
    'pac-12 network': 'PAC12',
    'pac12': 'PAC12',
    'tnt': 'TNT',
    'tbs': 'TBS',
    'nfl network': 'NFLN',
    'nfln': 'NFLN',
    'nba tv': 'NBATV',
    'nbav': 'NBATV',
    'mlb network': 'MLBN',
    'mlbn': 'MLBN',
    'nhl network': 'NHLN',
    'nhl': 'NHL',
  }
  
  // Check for exact match first
  if (abbreviations[networkLower]) {
    return abbreviations[networkLower]
  }
  
  // Check for partial matches
  for (const [key, abbrev] of Object.entries(abbreviations)) {
    if (networkLower.includes(key)) {
      return abbrev
    }
  }
  
  // If network name is long, abbreviate it
  if (network.length > 8) {
    // Take first 3-4 letters and make uppercase
    const words = network.split(' ')
    if (words.length > 1) {
      // Multiple words - take first letter of each
      return words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 4)
    } else {
      // Single word - take first 4-5 chars
      return network.slice(0, 5).toUpperCase()
    }
  }
  
  return network
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

function getTeamColor(team, fallbackColor = '#007bff') {
  if (!team) return fallbackColor
  // ESPN API provides color in team.color or team.alternateColor
  if (team.color) return team.color
  if (team.alternateColor) return team.alternateColor
  // Check if colors are nested in team object
  if (team.team?.color) return team.team.color
  if (team.team?.alternateColor) return team.team.alternateColor
  return fallbackColor
}

function hexToRgba(hex, alpha = 0.9) {
  if (!hex || typeof hex !== 'string') return `rgba(0, 123, 255, ${alpha})`
  // Remove # if present
  const cleaned = hex.replace('#', '')
  // Handle 3-character hex codes
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // Handle 6-character hex codes
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16)
    const g = parseInt(cleaned.slice(2, 4), 16)
    const b = parseInt(cleaned.slice(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(0, 123, 255, ${alpha})`
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // Fallback for invalid hex
  return `rgba(0, 123, 255, ${alpha})`
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
      // Compare as strings to ensure type matching
      hasPossession = game.possessionTeam && teamId && String(game.possessionTeam) === String(teamId)
      
      // Debug: Log possession check for first live game
      if (game.status === 'live' && (game.sport === 'nfl' || game.sport === 'college-football') && !window._loggedPossessionCheck) {
        window._loggedPossessionCheck = true
        console.log('=== POSSESSION CHECK DEBUG ===')
        console.log('Sport:', game.sport)
        console.log('Game possessionTeam:', game.possessionTeam, typeof game.possessionTeam)
        console.log('Team ID:', teamId, typeof teamId)
        console.log('Side:', side, 'isAway:', isAway)
        console.log('Has possession:', hasPossession)
        console.log('Comparison:', String(game.possessionTeam), '===', String(teamId))
      }
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
          {game.broadcastChannel ? ` • ${abbreviateNetwork(game.broadcastChannel)}` : ''}
        </span>
        {statusBadge}
      </div>
      <div className="game-content">
        <div className="teams">
          <TeamRow game={game} side="away" />
          {game.status === 'scheduled' && game.odds?.overUnder !== null && game.odds?.overUnder !== undefined && (
            <div className="over-under-display">
              O/U: {game.odds?.overUnder}
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
  const [showFullBoxScore, setShowFullBoxScore] = useState(false)
  const [playFilter, setPlayFilter] = useState('all') // Start with 'all' to ensure something is visible
  const [showPlayByPlay, setShowPlayByPlay] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      if (!game?.id || !game?.sport) return

      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchGameSummary(game.sport, game.id)
        if (!cancelled) {
          // Immediate debug - log the raw response structure
          console.log('=== SUMMARY API RESPONSE RECEIVED ===')
          console.log('Response keys:', Object.keys(data))
          console.log('Has header?', !!data.header)
          console.log('Has boxscore?', !!data.boxscore)
          if (data.header?.competitions?.[0]?.competitors) {
            data.header.competitions[0].competitors.forEach((comp, idx) => {
              console.log(`Header competitor[${idx}] has linescores:`, !!comp.linescores, comp.linescores)
            })
          }
          if (data.boxscore?.teams) {
            data.boxscore.teams.forEach((team, idx) => {
              console.log(`Boxscore team[${idx}] has linescores:`, !!team.linescores, team.linescores)
            })
          }
          if (data.boxscore?.situation) {
            console.log('Boxscore situation:', data.boxscore.situation)
            console.log('Situation keys:', Object.keys(data.boxscore.situation))
          }
          if (data.header?.competitions?.[0]?.situation) {
            console.log('Header situation:', data.header.competitions[0].situation)
            console.log('Header situation keys:', Object.keys(data.header.competitions[0].situation))
          }
          console.log('Full response structure:', JSON.stringify(data, null, 2).substring(0, 15000))
          
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
  
  // Extract quarter/period scores from linescores
  // Check multiple possible locations for linescores data
  // First check header.competitions (most common ESPN API location)
  const headerCompetitors = summaryData?.header?.competitions?.[0]?.competitors || []
  const headerAwayCompetitor = headerCompetitors.find(c => 
    String(c.team?.id) === String(game.awayTeamId) || 
    c.homeAway === 'away'
  )
  const headerHomeCompetitor = headerCompetitors.find(c => 
    String(c.team?.id) === String(game.homeTeamId) || 
    c.homeAway === 'home'
  )
  
  const awayLinescores = headerAwayCompetitor?.linescores ||
                         awayTeam?.linescores || 
                         boxscore?.linescores?.find(ls => String(ls.teamId || ls.team?.id) === String(awayTeam?.team?.id))?.linescores ||
                         summaryData?.linescores?.find(ls => String(ls.teamId || ls.team?.id) === String(awayTeam?.team?.id))?.linescores ||
                         []
  const homeLinescores = headerHomeCompetitor?.linescores ||
                         homeTeam?.linescores || 
                         boxscore?.linescores?.find(ls => String(ls.teamId || ls.team?.id) === String(homeTeam?.team?.id))?.linescores ||
                         summaryData?.linescores?.find(ls => String(ls.teamId || ls.team?.id) === String(homeTeam?.team?.id))?.linescores ||
                         []
  
  // Debug: log the structure to understand the data format
  if (summaryData && !window._loggedLinescoresDebug) {
    window._loggedLinescoresDebug = true
    console.log('=== LINESCORES DEBUG ===')
    console.log('summaryData keys:', Object.keys(summaryData))
    console.log('boxscore keys:', boxscore ? Object.keys(boxscore) : 'no boxscore')
    console.log('awayTeam keys:', awayTeam ? Object.keys(awayTeam) : 'no awayTeam')
    console.log('awayTeam.linescores:', awayTeam?.linescores)
    console.log('boxscore.linescores:', boxscore?.linescores)
    console.log('summaryData.linescores:', summaryData?.linescores)
    
    // Check header.competitions for linescores (common ESPN API location)
    const header = summaryData?.header
    console.log('header:', header)
    console.log('header.competitions:', header?.competitions)
    if (header?.competitions?.[0]?.competitors) {
      console.log('header.competitions[0].competitors:', header.competitions[0].competitors)
      header.competitions[0].competitors.forEach((comp, idx) => {
        console.log(`competitor[${idx}].linescores:`, comp.linescores)
        console.log(`competitor[${idx}].team.id:`, comp.team?.id)
        console.log(`competitor[${idx}].homeAway:`, comp.homeAway)
        if (comp.linescores) {
          console.log(`competitor[${idx}].linescores FULL:`, JSON.stringify(comp.linescores, null, 2))
        }
      })
    }
    
    // Recursively search for all "linescores" in the response
    const findAllLinescores = (obj, path = 'root') => {
      const results = []
      if (!obj || typeof obj !== 'object') return results
      
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            if ('linescores' in item) {
              results.push({ path: `${path}[${idx}].linescores`, value: item.linescores })
            }
            results.push(...findAllLinescores(item, `${path}[${idx}]`))
          }
        })
      } else {
        if ('linescores' in obj) {
          results.push({ path: `${path}.linescores`, value: obj.linescores })
        }
        Object.keys(obj).forEach(key => {
          if (obj[key] && typeof obj[key] === 'object') {
            results.push(...findAllLinescores(obj[key], `${path}.${key}`))
          }
        })
      }
      return results
    }
    
    const allLinescores = findAllLinescores(summaryData)
    console.log('=== ALL LINESCORES FOUND IN RESPONSE ===')
    if (allLinescores.length > 0) {
      allLinescores.forEach((result, idx) => {
        console.log(`Location ${idx + 1}: ${result.path}`)
        console.log(`Value:`, result.value)
        console.log(`Type:`, Array.isArray(result.value) ? 'array' : typeof result.value)
        if (Array.isArray(result.value) && result.value.length > 0) {
          console.log(`First item:`, result.value[0])
          console.log(`Full array:`, JSON.stringify(result.value, null, 2))
        }
        console.log('---')
      })
    } else {
      console.log('NO LINESCORES FOUND ANYWHERE IN RESPONSE!')
    }
    
    // Log full summaryData structure (first 10000 chars)
    console.log('Full summaryData (first 10000 chars):', JSON.stringify(summaryData, null, 2).substring(0, 10000))
  }
  
  const plays = summaryData?.plays || 
                summaryData?.boxscore?.plays || 
                summaryData?.drives?.previous?.flatMap(d => d.plays || []) ||
                summaryData?.drives?.current?.plays ||
                []

  // Determine if we have any scoring plays to decide the default filter
  const hasScoringPlays = plays.some(p => p.scoringPlay || p.type?.text?.toLowerCase().includes('touchdown') || p.type?.text?.toLowerCase().includes('field goal'))

  // Debug plays
  if (summaryData && !window._loggedPlaysDebug) {
    window._loggedPlaysDebug = true
    console.log('=== PLAYS DEBUG ===')
    console.log('Plays count:', plays.length)
    console.log('Has scoring plays:', hasScoringPlays)
    if (plays.length > 0) {
      console.log('Sample play keys:', Object.keys(plays[0]))
      console.log('Sample play:', JSON.stringify(plays[0], null, 2))
    }
  }
  const headlines = summaryData?.headlines || []
  const commentary = summaryData?.commentary || []
  
  // Calculate quarter scores from scoring plays if linescores aren't available
  const calculateQuarterScores = () => {
    const awayScores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const homeScores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let lastAwayScore = 0
    let lastHomeScore = 0
    
    // Filter to only scoring plays and sort by period
    const scoringPlays = plays.filter(play => 
      play.scoringPlay || 
      play.type?.text?.toLowerCase().includes('touchdown') ||
      play.type?.text?.toLowerCase().includes('field goal') ||
      play.type?.text?.toLowerCase().includes('safety') ||
      play.type?.text?.toLowerCase().includes('goal') ||
      (play.awayScore !== undefined && play.homeScore !== undefined && 
       (play.awayScore !== lastAwayScore || play.homeScore !== lastHomeScore))
    )
    
    // Sort plays by period and time
    const sortedPlays = [...scoringPlays].sort((a, b) => {
      const periodA = a.period?.number || a.period || 0
      const periodB = b.period?.number || b.period || 0
      if (periodA !== periodB) return periodA - periodB
      return 0
    })
    
    sortedPlays.forEach(play => {
      // Try multiple ways to get scores from play
      const awayScore = Number(play.awayScore ?? play.score?.away ?? play.scores?.away ?? 0)
      const homeScore = Number(play.homeScore ?? play.score?.home ?? play.scores?.home ?? 0)
      
      if (!isNaN(awayScore) && !isNaN(homeScore) && (awayScore !== lastAwayScore || homeScore !== lastHomeScore)) {
        const period = play.period?.number ?? play.period ?? play.periodNumber ?? 1
        const periodNum = Number(period)
        
        if (periodNum >= 1 && periodNum <= 5) {
          const awayDiff = awayScore - lastAwayScore
          const homeDiff = homeScore - lastHomeScore
          if (awayDiff > 0) awayScores[periodNum] += awayDiff
          if (homeDiff > 0) homeScores[periodNum] += homeDiff
          lastAwayScore = awayScore
          lastHomeScore = homeScore
        }
      }
    })
    
    // Debug logging
    if (sortedPlays.length > 0 && !window._loggedQuarterCalc) {
      window._loggedQuarterCalc = true
      console.log('=== QUARTER SCORES CALCULATION ===')
      console.log('Scoring plays count:', sortedPlays.length)
      console.log('Calculated away scores:', awayScores)
      console.log('Calculated home scores:', homeScores)
      console.log('Sample play:', sortedPlays[0])
    }
    
    return { away: awayScores, home: homeScores }
  }
  
  const calculatedScores = calculateQuarterScores()
  
  // Try to get linescores from event data if not found in team data
  const eventLinescores = summaryData?.boxscore?.linescores || summaryData?.linescores || []
  const awayLinescoresFinal = awayLinescores.length > 0 ? awayLinescores : 
    (eventLinescores.find(ls => ls.teamId === awayTeam?.team?.id || ls.team?.id === awayTeam?.team?.id)?.linescores || [])
  const homeLinescoresFinal = homeLinescores.length > 0 ? homeLinescores : 
    (eventLinescores.find(ls => ls.teamId === homeTeam?.team?.id || ls.team?.id === homeTeam?.team?.id)?.linescores || [])
  
  // Helper to get score for a specific period
  const getPeriodScore = (linescores, periodNumber, teamType) => {
    // First try calculated scores from plays (more reliable if API doesn't provide linescores)
    if (calculatedScores && calculatedScores[teamType] && calculatedScores[teamType][periodNumber] > 0) {
      return String(calculatedScores[teamType][periodNumber])
    }
    
    // Then try linescores if available
    if (!linescores || linescores.length === 0) {
      return '-'
    }
    
    // If linescores is an array, try index-based access (0-based, so period 1 = index 0)
    if (Array.isArray(linescores)) {
      const scoreEntry = linescores[periodNumber - 1]
      if (scoreEntry) {
        // Handle different data structures
        if (typeof scoreEntry === 'number') {
          return String(scoreEntry)
        }
        if (typeof scoreEntry === 'object') {
          const result = scoreEntry.value || scoreEntry.displayValue || scoreEntry.score || scoreEntry.text || '-'
          if (result !== '-') return result
        } else {
          return String(scoreEntry)
        }
      }
      
      // Also try finding by period number
      const found = linescores.find(ls => {
        if (typeof ls === 'object' && ls !== null) {
          return ls.period === periodNumber || 
                 ls.period?.number === periodNumber || 
                 ls.period?.displayValue === String(periodNumber) ||
                 ls.period?.value === periodNumber
        }
        return false
      })
      if (found) {
        const result = found.value || found.displayValue || found.score || found.text || '-'
        if (result !== '-') return result
      }
    }
    
    // Fallback to calculated scores from plays
    if (calculatedScores && calculatedScores[teamType] && calculatedScores[teamType][periodNumber] > 0) {
      return String(calculatedScores[teamType][periodNumber])
    }
    
    return '-'
  }
  
  // Extract player stats and leaders
  // The structure is: leaders = [{ team: {...}, leaders: [{ name: "passingYards", displayName: "Passing Yards", leaders: [{ athlete: {...}, ... }] }] }]
  let leadersData = summaryData?.leaders || boxscore?.leaders || []
  
  // Also check if leaders are in header.competitions[0].leaders
  if (leadersData.length === 0 && summaryData?.header?.competitions?.[0]?.leaders) {
    leadersData = summaryData.header.competitions[0].leaders
  }
  
  // Transform the leaders data structure to match what we need
  // Group stat categories together, finding the leader from each team
  const statCategories = []
  if (leadersData.length > 0) {
    // Get all unique stat categories from all teams
    const categoryMap = new Map()
    
    leadersData.forEach((teamLeader) => {
      const teamId = teamLeader.team?.id
      if (!teamId || !teamLeader.leaders) return
      
      teamLeader.leaders.forEach((category) => {
        const categoryName = category.name || category.displayName
        if (!categoryName || !category.leaders || category.leaders.length === 0) return
        
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
          name: category.name,
          displayName: category.displayName,
          leaders: []
        })
        }
        
        const categoryData = categoryMap.get(categoryName)
        // Add the player leader from this team
        const playerLeader = category.leaders[0] // Get top leader for this category
        if (playerLeader) {
          categoryData.leaders.push({
            ...playerLeader,
            teamId: teamId
          })
        }
      })
    })
    
    // Convert map to array
    const categories = Array.from(categoryMap.values())
    
    // Enforce specific order: Passing, Rushing, Receiving, Sacks, Tackles
    const order = ['passingYards', 'rushingYards', 'receivingYards', 'sacks', 'totalTackles']
    
    statCategories.push(...categories.sort((a, b) => {
      const indexA = order.indexOf(a.name)
      const indexB = order.indexOf(b.name)
      if (indexA === -1 && indexB === -1) return 0
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    }))
  }
  
  // Debug: Log leaders structure
  if (summaryData && !window._loggedLeadersDebug) {
    window._loggedLeadersDebug = true
    console.log('=== GAME LEADERS DEBUG ===')
    console.log('Raw leadersData:', leadersData)
    console.log('Transformed statCategories:', statCategories)
    console.log('Away team ID:', awayTeam?.team?.id, game.awayTeamId)
    console.log('Home team ID:', homeTeam?.team?.id, game.homeTeamId)
  }
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

  const parseNumericValue = (value) => {
    if (value === null || value === undefined) return NaN
    if (typeof value === 'number') return value
    const str = String(value)
    const cleaned = str.replace(/[^\d.-]/g, '')
    const num = parseFloat(cleaned)
    return Number.isNaN(num) ? NaN : num
  }

  const awayScore = Number(game.awayScore) || 0
  const homeScore = Number(game.homeScore) || 0
  const totalScore = awayScore + homeScore
  const awayPercent = totalScore > 0 ? (awayScore / totalScore) * 100 : 50
  const homePercent = totalScore > 0 ? (homeScore / totalScore) * 100 : 50

  // Get team colors and logos from boxscore data if available, otherwise use game data
  // Use more neutral colors for team stats section
  const awayTeamColor = getTeamColor(awayTeam?.team, '#e0e0e0')
  const homeTeamColor = getTeamColor(homeTeam?.team, '#e0e0e0')
  const awayTeamLogo = awayTeam?.team?.logos?.[0]?.href || awayTeam?.team?.logo || game.awayLogo
  const homeTeamLogo = homeTeam?.team?.logos?.[0]?.href || homeTeam?.team?.logo || game.homeLogo

  // Snapshot Data Extraction
  const currentDrive = summaryData?.drives?.current
  
  // Exhaustive recursive search for situation data in the API response
  const findSituationInObject = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 10) return null;
    
    // Check if THIS object is a situation object
    const hasDown = obj.down !== undefined && obj.down !== null;
    const hasDist = obj.distance !== undefined && obj.distance !== null;
    const hasText = !!(obj.downDistanceText || obj.shortDownDistanceText || obj.yardLineText || obj.possessionText);
    
    if ((hasDown && hasDist) || hasText) {
      // Basic validation - if it has down/dist but they are 0/null, keep looking unless it has text
      if (hasText || (obj.down > 0)) return obj;
    }
    
    // Check children - prioritizing keys that sound like situation
    const keys = Object.keys(obj);
    const priorityKeys = keys.filter(k => k.toLowerCase().includes('situation') || k.toLowerCase().includes('lastplay') || k === 'status');
    const otherKeys = keys.filter(k => !priorityKeys.includes(k) && k !== 'plays' && k !== 'athletes' && k !== 'links');
    
    for (const key of [...priorityKeys, ...otherKeys]) {
      try {
        if (obj[key] && typeof obj[key] === 'object') {
          const found = findSituationInObject(obj[key], depth + 1);
          if (found) return found;
        }
      } catch (e) { /* ignore */ }
    }
    return null;
  };

  const situation = game?.situation || 
                    findSituationInObject(summaryData) || 
                    summaryData?.situation || 
                    summaryData?.boxscore?.situation || 
                    summaryData?.header?.competitions?.[0]?.situation ||
                    summaryData?.header?.competitions?.[0]?.status?.situation ||
                    summaryData?.drives?.current?.plays?.[summaryData?.drives?.current?.plays?.length - 1]?.situation ||
                    summaryData?.header?.competitions?.[0]?.status
  
  const winProbability = summaryData?.winprobability?.[summaryData.winprobability.length - 1]

  const possessionTeamId = String(
    situation?.possession || 
    situation?.possessionTeam?.id || 
    situation?.lastPlay?.team?.id || 
    summaryData?.drives?.current?.team?.id ||
    summaryData?.header?.competitions?.[0]?.competitors?.find(c => c.possession || c.possessionTeam?.id)?.team?.id ||
    ''
  )
  const isAwayPossession = possessionTeamId !== '' && possessionTeamId === String(awayTeam?.team?.id || game.awayTeamId)
  const isHomePossession = possessionTeamId !== '' && possessionTeamId === String(homeTeam?.team?.id || game.homeTeamId)
  
  // Is it currently halftime?
  const isHalftime = game.status === 'halftime' || game.statusName?.toLowerCase() === 'halftime'

  // Robust extraction of down and distance
  const downDistanceText = isHalftime ? 'HALFTIME' : situation?.downDistanceText || 
                          situation?.shortDownDistanceText ||
                          (situation?.down !== undefined && situation?.distance !== undefined && situation?.down > 0 ? 
                            `${situation.down}${situation.down === 1 ? 'st' : situation.down === 2 ? 'nd' : situation.down === 3 ? 'rd' : 'th'} & ${situation.distance}` : null) ||
                          (summaryData?.drives?.current?.lastPlay?.text?.match(/\d[a-z]{2}\s&\s\d+/) || [])[0] ||
                          (game.status === 'live' ? 'Live' : '-')
                          
  const yardLineText = situation?.yardLineText || 
                      situation?.possessionText ||
                      (situation?.yardLine !== undefined ? 
                        (situation.yardLine === 50 ? 'Midfield' : 
                         situation.yardLine > 50 ? `${game.homeAbbreviation} ${100 - situation.yardLine}` : 
                         `${game.awayAbbreviation} ${situation.yardLine}`) : null) ||
                      (summaryData?.drives?.current?.lastPlay?.text?.match(/at\s([A-Z]+\s\d+)/) || [])[1] ||
                      '-'

  // Calculate normalized yard line (0-100 where 0 is Away Goal, 100 is Home Goal)
  const getNormalizedYardLine = () => {
    const text = String(yardLineText || '').toUpperCase()
    const homeAbbr = String(game.homeAbbreviation || '').toUpperCase()
    const awayAbbr = String(game.awayAbbreviation || '').toUpperCase()
    const rawYL = situation?.yardLine ?? situation?.yardline ?? situation?.location
    
    // 1. Try to parse from text (most reliable for territory)
    // If it says "GB 31", and GB is Home (Right side), position is 100 - 31 = 69
    if (homeAbbr && text.includes(homeAbbr)) {
      const match = text.match(/\d+/)
      if (match) {
        const dist = parseInt(match[0])
        if (dist === 50) return 50
        return 100 - dist
      }
    }
    // If it says "BAL 31", and BAL is Away (Left side), position is 31
    if (awayAbbr && text.includes(awayAbbr)) {
      const match = text.match(/\d+/)
      if (match) return parseInt(match[0])
    }
    
    // 2. Fallback to raw yardLine (if absolute 0-100)
    if (rawYL !== undefined && rawYL !== null) {
      const ylNum = parseInt(rawYL)
      // If it's relative 0-50, we MUST use territory text
      if (ylNum <= 50) {
        if (text.includes('OPP') || text.includes('OPPONENT') || (homeAbbr && text.includes(homeAbbr) && isAwayPossession)) return 100 - ylNum
        if (text.includes('OWN') || (awayAbbr && text.includes(awayAbbr) && isAwayPossession)) return ylNum
      }
      return ylNum
    }
    
    return null
  }

  const normalizedYardLine = getNormalizedYardLine()

  // Debug field
  if (summaryData && !window._loggedFieldDebug) {
    window._loggedFieldDebug = true
    console.log('=== SITUATION SEARCH RESULTS ===')
    console.log('Data from game object:', game?.situation)
    console.log('Final Situation Found:', situation)
    console.log('Down/Dist Text:', downDistanceText)
    console.log('YardLine Text:', yardLineText)
    console.log('Possession ID:', possessionTeamId)
    console.log('Is Live?', game.status === 'live')
    
    // Scan for any object with 'down' key anywhere
    const findKeysRecursive = (obj, targetKey, path = 'root') => {
      if (!obj || typeof obj !== 'object') return;
      if (targetKey in obj) console.log(`FOUND ${targetKey} AT ${path}:`, obj[targetKey]);
      Object.keys(obj).forEach(k => {
        if (obj[k] && typeof obj[k] === 'object' && k !== 'plays' && k !== 'athletes') {
          findKeysRecursive(obj[k], targetKey, `${path}.${k}`);
        }
      });
    };
    findKeysRecursive(summaryData, 'down');
    findKeysRecursive(summaryData, 'yardLine');
  }

  const getTeamStat = (team, statName) => {
    const stat = team?.statistics?.find(s => s.name === statName)
    if (!stat) return '0'
    return typeof stat.displayValue === 'string' ? stat.displayValue : String(stat.value || '0')
  }

  return (
    <>
      <div className="game-summary-content">
        {isLoading && <div className="info">Loading game summary...</div>}
        {error && <div className="error">Error loading summary: {error}</div>}
        {summaryData && (
          <div>
            {/* Game Header */}
            <div className="game-info-header-new">
              <div className="game-header-top">
                <div className="game-time-status">
                  {game.status === 'live' && game.clock != null && game.period ? (() => {
                    // Safely convert clock to string
                    const clockStr = game.clock != null ? String(game.clock) : ''
                    let formattedClock = clockStr
                    
                    // If clock is a number (seconds), convert to MM:SS
                    const clockNum = Number(game.clock)
                    if (!isNaN(clockNum) && typeof clockStr === 'string' && clockStr.indexOf(':') === -1) {
                      const totalSeconds = Math.abs(clockNum)
                      const minutes = Math.floor(totalSeconds / 60)
                      const seconds = totalSeconds % 60
                      formattedClock = `${minutes}:${String(seconds).padStart(2, '0')}`
                    }
                    
                    const periodText = game.period === 1 ? '1st' : game.period === 2 ? '2nd' : game.period === 3 ? '3rd' : game.period === 4 ? '4th' : game.period ? `${game.period}th` : ''
                    return (
                      <span className="game-clock">
                        {formattedClock} - {periodText}
                      </span>
                    )
                  })() : game.status === 'live' ? (
                    <span className="game-status-live">LIVE</span>
                  ) : game.status === 'final' ? (
                    <span className="game-status-final">FINAL</span>
                  ) : game.displayTime ? (
                    <span className="game-status-scheduled">{game.displayTime}</span>
                  ) : (
                    <span className="game-status-scheduled">SCHEDULED</span>
                  )}
                </div>
              </div>
              <div className="game-teams-header-new">
                {/* Away Team - Left Side */}
                <div className="team-header-new team-away">
                  <div className="team-logo-side">
                    <TeamLogo 
                      name={game.awayTeam} 
                      logoUrl={awayTeamLogo} 
                      fallbackText={getFallbackText(game.awayTeam, game.awayShortName, game.awayAbbreviation)} 
                    />
                  </div>
                  <div className="team-info-side">
                    <div className="team-name-side" style={{ color: awayTeamColor }}>{game.awayTeam}</div>
                    <div className="team-record-side">{game.awayTeamRecord || ''}</div>
                </div>
                  <div className="team-score-side" style={{ color: awayTeamColor }}>{game.awayScore || '-'}</div>
                </div>

                {/* Center - Score Breakdown */}
                <div className="game-center-section">
                  <div className="quarter-scores-table">
                    <table className="quarter-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>1</th>
                          <th>2</th>
                          <th>3</th>
                          <th>4</th>
                          {game.sport === 'nfl' && <th>OT</th>}
                          <th>T</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="team-abbr">{game.awayAbbreviation || game.awayShortName || 'AWY'}</td>
                          <td>{getPeriodScore(awayLinescoresFinal, 1, 'away')}</td>
                          <td>{getPeriodScore(awayLinescoresFinal, 2, 'away')}</td>
                          <td>{getPeriodScore(awayLinescoresFinal, 3, 'away')}</td>
                          <td>{getPeriodScore(awayLinescoresFinal, 4, 'away')}</td>
                          {game.sport === 'nfl' && <td>{getPeriodScore(awayLinescoresFinal, 5, 'away') || '-'}</td>}
                          <td className="total-score">{game.awayScore || '0'}</td>
                        </tr>
                        <tr>
                          <td className="team-abbr">{game.homeAbbreviation || game.homeShortName || 'HME'}</td>
                          <td>{getPeriodScore(homeLinescoresFinal, 1, 'home')}</td>
                          <td>{getPeriodScore(homeLinescoresFinal, 2, 'home')}</td>
                          <td>{getPeriodScore(homeLinescoresFinal, 3, 'home')}</td>
                          <td>{getPeriodScore(homeLinescoresFinal, 4, 'home')}</td>
                          {game.sport === 'nfl' && <td>{getPeriodScore(homeLinescoresFinal, 5, 'home') || '-'}</td>}
                          <td className="total-score">{game.homeScore || '0'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {game.broadcastChannel && (
                    <div className="broadcast-info">{abbreviateNetwork(game.broadcastChannel)}</div>
                  )}
                </div>

                {/* Home Team - Right Side */}
                <div className="team-header-new team-home">
                  <div className="team-score-side" style={{ color: homeTeamColor }}>{game.homeScore || '-'}</div>
                  <div className="team-info-side">
                    <div className="team-name-side" style={{ color: homeTeamColor }}>{game.homeTeam}</div>
                    <div className="team-record-side">{game.homeTeamRecord || ''}</div>
                  </div>
                  <div className="team-logo-side">
                    <TeamLogo 
                      name={game.homeTeam} 
                      logoUrl={homeTeamLogo} 
                      fallbackText={getFallbackText(game.homeTeam, game.homeShortName, game.homeAbbreviation)} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Game Snapshot Section */}
            <div className="game-snapshot-container">
              <div className="snapshot-header-row">
                {currentDrive && (
                  <div className="current-drive-section">
                    <span className="current-drive-label">CURRENT DRIVE</span>
                    <span className="current-drive-info">
                      {Array.isArray(currentDrive.plays) ? currentDrive.plays.length : (currentDrive.plays || 0)} plays, {currentDrive.yards || 0} yards, {currentDrive.displayTime || ''}
                    </span>
                  </div>
                )}
                <div className="snapshot-situation">
                  <div className="situation-item">
                    <span className="snapshot-label">Down:</span>
                    <span className="snapshot-value">
                      {downDistanceText}
                    </span>
                  </div>
                  <div className="situation-item">
                    <span className="snapshot-label">Ball on:</span>
                    <span className="snapshot-value">
                      {yardLineText}
                    </span>
                  </div>
              </div>
            </div>

              {/* Football Field Visualization - 3D Perspective - Only for Live Games */}
              {(game.sport === 'nfl' || game.sport === 'college-football' || game.sportName?.toLowerCase().includes('football')) && 
               (game.status === 'live' || game.status === 'halftime') && (
                <div className="football-field-wrapper">
                  <div className="football-field">
                    <div 
                      className="field-endzone away-endzone" 
                      style={{ backgroundColor: `#${awayTeam?.team?.color || '333'}` }}
                    >
                      <span className="endzone-text">{game.awayShortName || game.awayAbbreviation}</span>
                    </div>
                    
                    <div className="field-grid">
                      {/* Drive Progress Lines */}
                      {normalizedYardLine !== null && (
                        <div className="drive-line-container">
                          {(() => {
                            const startYL = situation?.startYardLine || situation?.yardLine || 0;
                            // Need to normalize startYL too
                            const startPos = (startYL > 50 && isAwayPossession) || (startYL < 50 && isHomePossession) ? 100 - startYL : startYL;
                            const currentPos = normalizedYardLine;
                            
                            // 1. Solid line from drive start to current ball
                            const solidLeft = Math.min(startPos, currentPos);
                            const solidWidth = Math.abs(currentPos - startPos);
                            
                            // 2. Dashed line for distance to first down
                            const yardsToGo = situation?.distance || 0;
                            const direction = isHomePossession ? -1 : 1;
                            const firstDownPos = currentPos + (yardsToGo * direction);
                            const dashLeft = direction === 1 ? currentPos : firstDownPos;
                            const dashWidth = yardsToGo;

                            return (
                              <>
                                <div 
                                  className="drive-line-solid" 
                                  style={{ 
                                    left: `${solidLeft}%`, 
                                    width: `${solidWidth}%` 
                                  }}
                                />
                                {yardsToGo > 0 && (
                                  <div 
                                    className="drive-line-dashed" 
                                    style={{ 
                                      left: `${dashLeft}%`, 
                                      width: `${dashWidth}%` 
                                    }}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      <div className="yard-line-container">
                        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(line => (
                          <div key={line} className="field-yard-line" style={{ left: `${line}%` }}>
                            <span className="yard-num">{line > 50 ? 100 - line : line}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Ball Marker */}
                      {normalizedYardLine !== null && (
                        <div 
                          className="ball-marker-container" 
                          style={{ 
                            left: `${normalizedYardLine}%`
                          }}
                        >
                          <div className="ball-marker-icon">
                            <img 
                              src={isAwayPossession ? awayTeamLogo : isHomePossession ? homeTeamLogo : (awayTeamLogo || homeTeamLogo)} 
                              alt="" 
                              className="marker-logo" 
                            />
                            <div className="marker-pointer"></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div 
                      className="field-endzone home-endzone" 
                      style={{ backgroundColor: `#${homeTeam?.team?.color || '444'}` }}
                    >
                      <span className="endzone-text">{game.homeShortName || game.homeAbbreviation}</span>
                    </div>
                  </div>
                  <div className="field-labels-row">
                    <span className="field-label-left">{game.awayAbbreviation}</span>
                    <span className="field-label-center">50</span>
                    <span className="field-label-right">{game.homeAbbreviation}</span>
                  </div>
                </div>
              )}

              {/* Status Card */}
              <div className="snapshot-status-card">
                <div className="status-card-header">
                  <div className="status-title-group">
                    <span className="status-card-title">{game.status?.type?.detail || game.status?.type?.description || 'GAME STATUS'}</span>
                  </div>
                  {winProbability && (
                    <div className="win-prob">
                      Win %: 
                      {winProbability.homeWinPercentage > winProbability.awayWinPercentage ? (
                        <span className="win-prob-val">
                          <img src={homeTeamLogo} alt="" className="tiny-logo" /> {(winProbability.homeWinPercentage * 100).toFixed(1)}
                        </span>
                      ) : (
                        <span className="win-prob-val">
                          <img src={awayTeamLogo} alt="" className="tiny-logo" /> {(winProbability.awayWinPercentage * 100).toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="team-snapshot-cards">
                  {[awayTeam, homeTeam].map((team, idx) => {
                    const isAway = idx === 0;
                    const logo = isAway ? awayTeamLogo : homeTeamLogo;
                    const teamName = isAway ? game.awayTeam : game.homeTeam;
                    const record = isAway ? game.awayTeamRecord : game.homeTeamRecord;
                    const conference = isAway ? game.awayConference : game.homeConference;
                    
                    return (
                      <div key={idx} className="team-mini-card">
                        <div className="team-mini-header">
                          <div className="team-mini-logo">
                            <img src={logo} alt="" />
                          </div>
                          <div className="team-mini-info">
                            <div className="team-mini-name">{teamName}</div>
                            <div className="team-mini-record">{record} {conference ? `in ${conference}` : ''}</div>
                          </div>
                        </div>
                        <div className="team-mini-stats">
                          <div className="mini-stat-item">
                            <span className="mini-stat-label">YDS</span>
                            <span className="mini-stat-value">{getTeamStat(team, 'totalYards')}</span>
                          </div>
                          <div className="mini-stat-item">
                            <span className="mini-stat-label">T/O</span>
                            <span className="mini-stat-value">{getTeamStat(team, 'turnovers')}</span>
                          </div>
                          <div className="mini-stat-item">
                            <span className="mini-stat-label">TOP</span>
                            <span className="mini-stat-value">{getTeamStat(team, 'possessionTime')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Team Stats */}
            {boxscore && awayTeam && homeTeam && (
                <div className="boxscore-container">
                  <table className="boxscore-table">
                    <thead>
                      <tr>
                      <th colSpan={3} className="boxscore-title-header">
                        <div className="boxscore-title">Team Stats</div>
                        <div className="boxscore-header-teams-unified">
                          <div className="boxscore-header-team-unified">
                            <div className="boxscore-header-logo">
                              <TeamLogo 
                                name={awayTeam.team?.displayName || awayTeam.team?.name || game.awayTeam} 
                                logoUrl={awayTeamLogo} 
                                fallbackText={getFallbackText(game.awayTeam, game.awayShortName, game.awayAbbreviation)} 
                              />
                            </div>
                            <span className="boxscore-header-away" style={{ color: '#e0e0e0' }}>
                              {awayTeam.team?.displayName || awayTeam.team?.name || game.awayTeam}
                            </span>
                          </div>
                          <div className="boxscore-header-team-unified">
                            <div className="boxscore-header-logo">
                              <TeamLogo 
                                name={homeTeam.team?.displayName || homeTeam.team?.name || game.homeTeam} 
                                logoUrl={homeTeamLogo} 
                                fallbackText={getFallbackText(game.homeTeam, game.homeShortName, game.homeAbbreviation)} 
                              />
                            </div>
                            <span className="boxscore-header-home" style={{ color: '#e0e0e0' }}>
                              {homeTeam.team?.displayName || homeTeam.team?.name || game.homeTeam}
                            </span>
                          </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {awayTeam.statistics && homeTeam.statistics && awayTeam.statistics.map((stat, idx) => {
                        const homeStat = homeTeam.statistics[idx]
                        if (!stat || !homeStat) return null
                        const awayDisplay = stat.displayValue || stat.value || '-'
                        const homeDisplay = homeStat.displayValue || homeStat.value || '-'
                        const awayVal = parseNumericValue(stat.displayValue ?? stat.value)
                        const homeVal = parseNumericValue(homeStat.displayValue ?? homeStat.value)
                        const total = (Number.isNaN(awayVal) ? 0 : awayVal) + (Number.isNaN(homeVal) ? 0 : homeVal)
                        const awayPercent = total > 0 ? ((Number.isNaN(awayVal) ? 0 : awayVal) / total) * 100 : 50
                        const homePercent = total > 0 ? ((Number.isNaN(homeVal) ? 0 : homeVal) / total) * 100 : 50
                        // Use team colors from API, but fallback to neutral gray instead of blue/red
                        const awayColor = getTeamColor(awayTeam?.team, '#888888')
                        const homeColor = getTeamColor(homeTeam?.team, '#888888')
                        // Convert hex to rgba for gradient
                        const awayColorLight = hexToRgba(awayColor, 0.6)
                        const awayColorDark = hexToRgba(awayColor, 0.9)
                        const homeColorLight = hexToRgba(homeColor, 0.6)
                        const homeColorDark = hexToRgba(homeColor, 0.9)
                        return (
                          <tr key={idx}>
                            <td className="stat-label">{stat.label || stat.name}</td>
                            <td colSpan={2} className="boxscore-bar-cell">
                              <div className="boxscore-row-with-values">
                                <span className="boxscore-value away" style={{ color: awayColor }}>{awayDisplay}</span>
                                <div className="boxscore-row-bar">
                                  <div
                                    className="boxscore-row-bar-segment away"
                                    style={{ 
                                      width: `${awayPercent}%`,
                                      background: `linear-gradient(90deg, ${awayColorDark}, ${awayColorLight})`
                                    }}
                                  />
                                  <div
                                    className="boxscore-row-bar-segment home"
                                    style={{ 
                                      width: `${homePercent}%`,
                                      background: `linear-gradient(90deg, ${homeColorDark}, ${homeColorLight})`
                                    }}
                                  />
                                </div>
                                <span className="boxscore-value home" style={{ color: homeColor }}>{homeDisplay}</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
              </div>
            )}

            {/* Game Leaders */}
            {statCategories.length > 0 && (
              <div className="summary-section">
                <h3>GAME LEADERS</h3>
                <div className="game-leaders-container">
                  {/* Team Headers */}
                  <div className="game-leaders-header">
                    <div className="game-leaders-team-header away">
                      <div className="team-logo">
                        <TeamLogo 
                          name={game.awayTeam} 
                          logoUrl={awayTeamLogo} 
                          fallbackText={getFallbackText(game.awayTeam, game.awayShortName, game.awayAbbreviation)} 
                        />
                      </div>
                      <span className="game-leaders-team-abbr">{game.awayAbbreviation || game.awayShortName || 'AWY'}</span>
                    </div>
                    <div></div>
                    <div className="game-leaders-team-header home">
                      <div className="team-logo">
                        <TeamLogo 
                          name={game.homeTeam} 
                          logoUrl={homeTeamLogo} 
                          fallbackText={getFallbackText(game.homeTeam, game.homeShortName, game.homeAbbreviation)} 
                        />
                      </div>
                      <span className="game-leaders-team-abbr">{game.homeAbbreviation || game.homeShortName || 'HME'}</span>
                    </div>
                  </div>

                  {/* Leader Categories */}
                  {statCategories.slice(0, 5).map((category, idx) => {
                    const categoryLeaders = category.leaders || []
                    
                    const awayTeamId = String(awayTeam?.team?.id || game.awayTeamId || '')
                    const homeTeamId = String(homeTeam?.team?.id || game.homeTeamId || '')
                    
                    const awayLeader = categoryLeaders.find((l) => String(l.teamId || '') === awayTeamId)
                    const homeLeader = categoryLeaders.find((l) => String(l.teamId || '') === homeTeamId)
                    
                    const categoryName = category.displayName || category.name || 'Stat'
                    
                    return (
                      <div key={idx} className="game-leaders-row">
                        {/* Away Team Leader */}
                        <div className="game-leaders-player game-leaders-away">
                          <div className="player-headshot-stat-group">
                            <div className="game-leaders-player-image">
                              {awayLeader?.athlete?.headshot?.href ? (
                                <img src={awayLeader.athlete.headshot.href} alt="" />
                              ) : (
                                <div className="game-leaders-player-placeholder"></div>
                              )}
                        </div>
                            <div className="game-leaders-player-stat-large">
                              {awayLeader?.mainStat?.value || '-'}
                              </div>
                              </div>
                          <div className="game-leaders-player-info">
                            <div className="game-leaders-player-name">
                              {awayLeader?.athlete?.shortName || awayLeader?.athlete?.displayName || '-'}
                              <span className="game-leaders-player-position"> {awayLeader?.athlete?.position?.abbreviation || ''}</span>
                              </div>
                            <div className="game-leaders-player-details">
                              {awayLeader?.summary || '-'}
                            </div>
                          </div>
                        </div>

                        {/* Stat Title in Middle */}
                        <div className="game-leaders-category-label">{categoryName}</div>

                        {/* Home Team Leader */}
                        <div className="game-leaders-player game-leaders-home">
                          <div className="player-headshot-stat-group">
                            <div className="game-leaders-player-stat-large">
                              {homeLeader?.mainStat?.value || '-'}
                            </div>
                            <div className="game-leaders-player-image">
                              {homeLeader?.athlete?.headshot?.href ? (
                                <img src={homeLeader.athlete.headshot.href} alt="" />
                              ) : (
                                <div className="game-leaders-player-placeholder"></div>
                              )}
                            </div>
                          </div>
                          <div className="game-leaders-player-info">
                            <div className="game-leaders-player-name">
                              {homeLeader?.athlete?.shortName || homeLeader?.athlete?.displayName || '-'}
                              <span className="game-leaders-player-position"> {homeLeader?.athlete?.position?.abbreviation || ''}</span>
                            </div>
                            <div className="game-leaders-player-details">
                              {homeLeader?.summary || '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {boxscore?.players && (
                  <div style={{ textAlign: 'center', marginTop: '20px', paddingBottom: '10px' }}>
                    <button 
                      className="boxscore-toggle-btn"
                      onClick={() => setShowFullBoxScore(!showFullBoxScore)}
                    >
                      {showFullBoxScore ? 'Hide Full Box Score' : 'View Full Box Score'}
                    </button>
                  </div>
                )}

                {showFullBoxScore && boxscore?.players && (
                  <div className="full-boxscore-container">
                    {boxscore.players.map((teamData, tIdx) => {
                      const teamName = tIdx === 0 ? game.awayTeam : game.homeTeam
                      const teamColor = tIdx === 0 ? awayTeamColor : homeTeamColor
                      
                      return (
                        <div key={tIdx} className="team-boxscore">
                          <h4 style={{ color: teamColor, borderBottom: `1px solid ${teamColor}44`, paddingBottom: '8px', marginBottom: '15px' }}>
                            {teamName.toUpperCase()}
                          </h4>
                          
                          {teamData.statistics?.map((statCat, sIdx) => (
                            <div key={sIdx} className="stat-category-block">
                              <h5 className="stat-category-title">{statCat.name.toUpperCase()}</h5>
                              <div className="table-responsive">
                                <table className="full-boxscore-table">
                                  <thead>
                                    <tr>
                                      <th>PLAYER</th>
                                      {statCat.labels?.map((label, lIdx) => (
                                        <th key={lIdx}>{label}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {statCat.athletes?.map((player, pIdx) => (
                                      <tr key={pIdx}>
                                        <td className="player-cell">
                                          <div className="player-name">{player.athlete?.displayName || 'Player'}</div>
                                          <div className="player-pos">{player.athlete?.position?.abbreviation || ''}</div>
                                        </td>
                                        {player.stats?.map((stat, stIdx) => (
                                          <td key={stIdx}>{stat}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                        </div>
                            </div>
                          ))}
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )}

            {/* Play-by-Play */}
            {plays.length > 0 && (
              <div className="summary-section collapsible-section">
                <div 
                  className={`section-header-row clickable ${showPlayByPlay ? 'expanded' : ''}`}
                  onClick={() => setShowPlayByPlay(!showPlayByPlay)}
                >
                  <div className="header-title-group">
                    <h3>PLAY-BY-PLAY</h3>
                    <span className={`expand-icon ${showPlayByPlay ? 'expanded' : ''}`}>▼</span>
                  </div>
                  <div className="play-toggle-container" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className={`play-toggle-btn ${playFilter === 'scoring' ? 'active' : ''}`}
                      onClick={() => setPlayFilter('scoring')}
                    >
                      Scoring Plays
                    </button>
                    <button 
                      className={`play-toggle-btn ${playFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setPlayFilter('all')}
                    >
                      All Plays
                    </button>
                  </div>
                </div>

                <div className="play-by-play-list">
                  {(() => {
                    const filteredPlays = plays.filter(play => {
                      if (playFilter === 'all') return true;
                      return play.scoringPlay || 
                             play.type?.text?.toLowerCase().includes('touchdown') || 
                             play.type?.text?.toLowerCase().includes('field goal') ||
                             play.type?.text?.toLowerCase().includes('safety');
                    }).reverse();

                    if (filteredPlays.length === 0) {
                      return <div className="no-plays-message">No {playFilter === 'scoring' ? 'scoring' : ''} plays found for this game.</div>;
                    }

                    // Only show latest 5 if not expanded
                    const displayPlays = showPlayByPlay ? filteredPlays : filteredPlays.slice(0, 5);

                    // Group plays by period
                    const groupedPlays = displayPlays.reduce((groups, play) => {
                      const period = play.period?.number || play.period || 1;
                      if (!groups[period]) groups[period] = [];
                      groups[period].push(play);
                      return groups;
                    }, {});

                    return (
                      <>
                        {Object.keys(groupedPlays).sort((a, b) => b - a).map(period => (
                          <div key={period} className="period-group">
                            <div className="period-header">
                              {String(period) === '1' ? '1ST QUARTER' : 
                               String(period) === '2' ? '2ND QUARTER' : 
                               String(period) === '3' ? '3RD QUARTER' : 
                               String(period) === '4' ? '4TH QUARTER' : 
                               `PERIOD ${period}`}
                            </div>
                            {groupedPlays[period].map((play, idx) => {
                              const playTeamId = String(play.team?.id || '');
                              const isAwayTeam = playTeamId === String(awayTeam?.team?.id || game.awayTeamId);
                              const teamLogo = isAwayTeam ? awayTeamLogo : homeTeamLogo;
                              
                              return (
                                <div key={idx} className="play-card">
                                  <div className="play-card-left">
                                    <div className="play-team-logo">
                                      {teamLogo ? <img src={teamLogo} alt="" /> : <div className="logo-placeholder" />}
                                    </div>
                                    <div className="play-content">
                                      <div className="play-type-row">
                                        <span className="play-type-text">
                                          {typeof play.type?.text === 'string' ? play.type.text : 'Play'}
                                        </span>
                                        <span className="play-time-text">
                                          {typeof play.clock?.displayValue === 'string' ? play.clock.displayValue : ''}
                                          {play.clock?.displayValue && ' - '}
                                          {period === '1' ? '1st' : period === '2' ? '2nd' : period === '3' ? '3rd' : period === '4' ? '4th' : `${period}th`}
                                        </span>
                                      </div>
                                      <div className="play-description">
                                        {typeof play.text === 'string' ? play.text : (play.text?.displayValue || play.shortText || '')}
                                      </div>
                                      {(play.drive?.description || play.drive?.displayValue || play.statYardage) && (
                                        <div className="play-drive-info">
                                          {typeof (play.drive?.description || play.drive?.displayValue) === 'string' 
                                            ? (play.drive?.description || play.drive?.displayValue) 
                                            : `${play.statYardage || 0} yards`}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="play-card-right">
                                    <div className="play-score-update">
                                      <div className="score-numbers">
                                        <span className="score-away">
                                          {typeof play.awayScore === 'object' ? (play.awayScore?.value ?? '-') : (play.awayScore ?? '-')}
                                        </span>
                                        <span className="score-home">
                                          {typeof play.homeScore === 'object' ? (play.homeScore?.value ?? '-') : (play.homeScore ?? '-')}
                                        </span>
                                      </div>
                                      <div className="score-labels">
                                        <span className="label-away">{game.awayAbbreviation || 'AWY'}</span>
                                        <span className="label-home">{game.homeAbbreviation || 'HME'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                        {!showPlayByPlay && filteredPlays.length > 5 && (
                          <div className="show-more-indicator" onClick={() => setShowPlayByPlay(true)}>
                            + {filteredPlays.length - 5} more plays. Click to expand full Play-by-Play.
                          </div>
                        )}
                      </>
                    );
                  })()}
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
    </>
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
  const [showLiveOnly, setShowLiveOnly] = useState(false)

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
    setShowLiveOnly(false)
    setSelectedGame(null)
  }

  const handleDaySelect = (dayKey) => {
    const targetDate = dayDates[dayKey]
    if (!targetDate) return
    setActiveDay(dayKey)
    setCurrentDate(targetDate)
    setShowLiveOnly(false)
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
    let baseScores =
      selectedSport === 'all'
        ? scores
        : scores.filter((game) => game.sport === selectedSport)
    
    if (showLiveOnly) {
      baseScores = baseScores.filter(game => game.status === 'live' || game.status === 'halftime')
    }
    
    const copy = [...baseScores]
    copy.sort(compareGames)
    return copy
  }, [scores, selectedSport, showLiveOnly])


  const liveCount = useMemo(() => {
    const sportScores = selectedSport === 'all'
      ? scores
      : scores.filter((game) => game.sport === selectedSport)
    return sportScores.filter((game) => game.status === 'live' || game.status === 'halftime').length
  }, [scores, selectedSport])

  // Show game summary if a game is selected
  const mainContent = selectedGame ? (
    <GameSummary game={selectedGame} onBack={handleBackToScores} />
  ) : (
    <>
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
    </>
  )

  return (
    <div className="container">
      <div className="site-header">
        <div className="header-left" onClick={handleBackToScores} style={{ cursor: 'pointer' }}>
          <img src="helmet logo.png" alt="Quiet Scores Logo" className="site-logo" />
          <h1>Quiet Scores</h1>
        </div>

        <div className="header-center">
        <div className="sport-filters">
            <div
              className={`live-games-indicator ${showLiveOnly ? 'active' : ''}`}
              style={{ display: liveCount > 0 ? 'flex' : 'none', cursor: 'pointer' }}
              onClick={() => {
                setShowLiveOnly(!showLiveOnly)
                setSelectedGame(null)
              }}
            >
              <span className="count" id="liveGamesCount">
                {liveCount}
              </span>
              <span>Live</span>
            </div>
            <div className="filter-divider"></div>
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

        <div className="header-right">
          {/* Right side spacer for balance */}
          </div>
      </div>

      {mainContent}
    </div>
  )
}

export default App
