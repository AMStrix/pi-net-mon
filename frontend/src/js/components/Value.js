import React, { Component } from "react";
import styled from 'styled-components';

import { grayText } from '../colors';

const hop = (p, x, a, b) => p.hasOwnProperty(x) ? a : b;

const Style = styled.div`
  margin: ${p => p.hasOwnProperty('inline') ? '0 10px 2px 0' : '12px 0'};
  display: ${p => p.hasOwnProperty('inline') ? 'inline-block' : 'block'};
`;

const Item = styled.div`
  font-size: ${p => hop(p, 'small', '1em', '1.4em')};
  font-weight: ${p => hop(p, 'small', 'normal', 'bold')};
`;

const Label = styled.div`
  font-size: 0.8em;
  line-height: 0.8em;
  color: ${grayText};
`;

const Value = p => {
  const {label, value} = p;
  return (<Style {...p}>
    { (typeof value == 'string') && <Item {...p}>{value}</Item> || value }
    {label&&<Label {...p}>{label}</Label>}
  </Style>);
}

export default Value;