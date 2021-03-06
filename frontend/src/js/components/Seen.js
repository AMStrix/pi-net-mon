
import React, { Component } from "react";
import styled from 'styled-components';
import moment from 'moment';
import { Icon, Popup } from 'semantic-ui-react';

import { grayText } from '../colors';

const Style = styled.div`
  color: ${grayText};
  display: inline-block;
  cursor: default;
  ${({margin}) => margin && `margin: ${margin};`}
  ${({float}) => float && `float: ${float};`}
  ${({size}) => size && size == 'smaller' && `font-size: 0.9em;`}
`;


const Seen = p => {
  const {when, tip} = p;
  const render = p => (
    <span>
      {/*<Icon name='clock'/>*/}
      { moment(when).from(new Date()) }
    </span>
  );
  if (tip) return (
    <Style {...p}>
      <Popup
        trigger={render()}
        content={tip}
        style={{ opacity: 0.8 }}
        inverted
      />
    </Style>
  );
  return <Style {...p}>{render()}</Style>;
}

export default Seen;