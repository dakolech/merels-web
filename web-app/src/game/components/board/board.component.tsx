import * as React from 'react';
import { connect } from 'react-redux';
import { path } from 'ramda';
import { BoxComponent } from './box.component';
import { GameState } from '../../game.reducer';
import { BoardToDraw } from '../../board.generator';
import styled from 'styled-components';

interface Props {
  board: BoardToDraw;
  boxSize: number;
}

const Row = styled.div`
  display: inline-block;
`;

const Cell = styled.div`
  display: block;
`;

const Container = styled.div`
  position: absolute;
  top: 0;
  left: 0;
`;

function Board(props: Props) {
  console.log('Board')
  return (
    <Container>
      {props.board.map((column, columnIndex) => (
        <Row key={columnIndex}>
          {column.map((box, boxIndex) => (
            <Cell
              key={boxIndex}
              style={{ width: props.boxSize, height: props.boxSize }}
            >
              <BoxComponent key={boxIndex} box={box} boxSize={props.boxSize} />
            </Cell>
          ))}
        </Row>
      ))}
    </Container>
  );
}

const mapStateToProps = (state: GameState) => ({
  board: path(['game', 'boardToDraw'], state),
  boxSize: path(['game', 'boxSize'], state),
});

export const BoardComponent = connect(mapStateToProps)(Board);