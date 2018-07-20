import styled from 'styled-components';

const itemW = 250;
const gutter = 5;
const padding = 8;
const boxShadow = '1px 1px 5px #b1b1b1';

const Grid = styled.div`
  align-self: flex-start;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  flex-grow: 1;
`;

export default Grid;

Grid.Head = styled.div`
  width: 100%;
  background: white;
  box-shadow: ${boxShadow};
  margin: ${gutter}px;
  padding: ${padding}px;
`;
Grid.Item = styled.div`
  position: relative;
  width: ${p => p.hasOwnProperty('full') ? 100+'%' : itemW+'px'};
  margin: ${gutter}px;
  padding: ${padding * (1/2)}px ${padding}px ${padding * (3/8)}px;
  background: white;
  box-shadow: ${boxShadow};
  & hr {
    border-width: 0.5px;
    border-style: solid;
    border-color: #dcdcdc;
    margin: 3px -${padding}px 3px;
  }
  & ._top {}
  & ._middle {
    font-size: 0.8em;
  }
  & ._bottom {
    font-size: 0.8em;
    color: #9a9a9a;
  }
  ._scanButton {
    visibility: hidden;
    opacity: 0;
    transition: visibility 0s, opacity 300ms linear;
  }
  &:hover ._scanButton {
    visibility: visible;
    opacity: 1;
  }
`;
Grid.Overlay = styled.div`
  z-index: 100;
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.9);
  color: white;
  & ._scroll {
    position: absolute;
    top: 0; bottom: 0; left: 0; right: 0;
    overflow-y: auto;
    padding: 4px 3px 0 6px;
  }
  & ._close {
    z-index: 1;
    margin: 4px;
    font-size: 16px;
    position: absolute;
    right: 0;
  }
  & ._close:hover {
    cursor: pointer;
  }
  & table { 
    width: 100%; 
    th { text-align: left; }
  }
`;
Grid.Overlay.Notice = styled.div`
  height: 100%;
  display: flex;
  font-size: 1rem;
  flex-direction: column;
  & ._content {
    display: flex;
    align-items: center;
    flex-grow: 1;
    & > div {
      text-align: center;
      flex-grow: 1;
    }
  }
  & ._controls {
    margin-bottom: 6px;
  }
`;