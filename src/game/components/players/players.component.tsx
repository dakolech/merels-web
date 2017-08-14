import * as React from 'react';
import { connect } from 'react-redux';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';

// import { styles } from './players.styles';
import { PLAYER, PLAYER1, PLAYER2 } from '../../game.reducer';
import { AppState } from '../../../configureStore';
import { path } from 'ramda';
import styled from 'styled-components';
interface Props {
  player: PLAYER;
}

function PlayerTab(props: Props) {
  const PawnIcon = styled.i`
      font-size: 30px;
      color: ${props.player.color};
      `;
  return (
    <div>
      <span> {props.player.name} </span>

      <PawnIcon className="fa fa-circle"></PawnIcon>;
      <span> Pawns in the hand: {props.player.pawnsInHand} </span>
      <span> Pawns on the board: {props.player.pawnsOnBoard} </span>
    </div>
  );
}

function Players({ [PLAYER1]: player1, [PLAYER2]: player2 }) {
  return (
    <div>
      <PlayerTab player={player1} />
      <PlayerTab player={player2} />
    </div>
  );
}

const mapStateToProps = (state: AppState) => ({
  [PLAYER1]: path(['game', PLAYER1], state),
  [PLAYER2]: path(['game', PLAYER2], state),
});

export const PlayersComponent = connect(mapStateToProps)(Players);