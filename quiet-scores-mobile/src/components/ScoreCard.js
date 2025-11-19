import React from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';

function getSportDisplayName(sport) {
  switch (sport) {
    case 'nfl':
      return 'NFL';
    case 'nba':
      return 'NBA';
    case 'mlb':
      return 'MLB';
    case 'nhl':
      return 'NHL';
    case 'college-football':
      return 'CFB';
    case 'college-basketball':
      return 'CBB';
    default:
      return sport?.toUpperCase() ?? 'SPORT';
  }
}

function abbreviateNetwork(network) {
  if (!network) return '';
  const networkLower = network.toLowerCase();
  const abbreviations = {
    espn: 'ESPN',
    espn2: 'ESPN2',
    abc: 'ABC',
    cbs: 'CBS',
    nbc: 'NBC',
    fox: 'FOX',
    fs1: 'FS1',
    tnt: 'TNT',
  };
  if (abbreviations[networkLower]) {
    return abbreviations[networkLower];
  }
  return network.length > 8 ? network.slice(0, 5).toUpperCase() : network;
}

function getStatusBadge(game) {
  const timeText = game.time || '';
  switch (game.status) {
    case 'live':
      return {text: timeText || 'Live', color: '#dc3545'};
    case 'halftime':
      return {text: 'HALFTIME', color: '#ffc107'};
    case 'final':
      return {text: 'FINAL', color: '#28a745'};
    case 'postponed':
      return {text: 'POSTPONED', color: '#6c757d'};
    default:
      return {text: game.displayTime || timeText || 'TBD', color: '#6c757d'};
  }
}

function getWinner(game) {
  const awayScore = Number(game.awayScore);
  const homeScore = Number(game.homeScore);
  if (Number.isNaN(awayScore) || Number.isNaN(homeScore)) return null;
  if (awayScore === homeScore) return null;
  return awayScore > homeScore ? 'away' : 'home';
}

function TeamRow({game, side, scheduled}) {
  const isAway = side === 'away';
  const teamName = isAway ? game.awayTeam : game.homeTeam;
  const teamShortName = isAway ? game.awayShortName : game.homeShortName;
  const score = isAway ? game.awayScore : game.homeScore;
  const record = isAway ? game.awayTeamRecord : game.homeTeamRecord;
  const isWinner = getWinner(game) === side;
  const logoUrl = isAway ? game.awayLogo : game.homeLogo;
  const displayName = teamShortName || teamName;

  // Check for possession/at-bat highlighting
  let hasPossession = false;
  if (game.status === 'live' || game.status === 'halftime') {
    if (game.sport === 'nfl' || game.sport === 'college-football') {
      const teamId = isAway ? game.awayTeamId : game.homeTeamId;
      // Compare as strings to ensure type matching
      hasPossession =
        game.possessionTeam && teamId && String(game.possessionTeam) === String(teamId);
    } else if (game.sport === 'mlb') {
      hasPossession = game.atBatTeam === side;
    }
  }

  return (
    <View
      style={[
        styles.teamRow,
        isWinner && game.status === 'final' && styles.teamRowWinner,
        hasPossession && styles.teamRowPossession,
      ]}>
      <View style={styles.teamInfo}>
        {logoUrl ? (
          <Image source={{uri: logoUrl}} style={styles.teamLogo} />
        ) : (
          <View style={styles.fallbackLogo}>
            <Text style={styles.fallbackText}>
              {displayName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.teamDetails}>
          <Text style={styles.teamName}>{displayName}</Text>
          {record && <Text style={styles.teamRecord}>{record}</Text>}
        </View>
      </View>
      <Text style={[styles.teamScore, scheduled && styles.teamScoreScheduled]}>
        {scheduled ? '' : score}
      </Text>
    </View>
  );
}

function ScoreCard({game, onPress}) {
  const badge = getStatusBadge(game);
  const scheduled = game.status === 'scheduled';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.sportType}>
          {getSportDisplayName(game.sport)}
          {game.broadcastChannel
            ? ` • ${abbreviateNetwork(game.broadcastChannel)}`
            : ''}
        </Text>
        <Text style={[styles.statusBadge, {color: badge.color}]}>
          {badge.text}
        </Text>
      </View>
      <View style={styles.cardContent}>
        <TeamRow game={game} side="away" scheduled={scheduled} />
        <TeamRow game={game} side="home" scheduled={scheduled} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportType: {
    color: '#007bff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusBadge: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardContent: {
    gap: 12,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  teamRowWinner: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(76, 175, 80, 0.3)',
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    paddingLeft: 6,
  },
  teamRowPossession: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0, 123, 255, 0.4)',
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    paddingLeft: 6,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  teamLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  fallbackLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  teamDetails: {
    gap: 2,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  teamRecord: {
    fontSize: 11,
    color: '#cccccc',
    opacity: 0.8,
  },
  teamScore: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  teamScoreScheduled: {
    color: '#888888',
    fontStyle: 'italic',
    fontWeight: '500',
  },
});

export default ScoreCard;

