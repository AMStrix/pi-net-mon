import React, { Component } from "react";
import styled from 'styled-components';

const Styled = styled.div`
  background-color: ${p => p.color || 'gray'};
  color: white;
  text-shadow: 0.5px 0.5px 1px black;
  padding: 0 5px;
  display: inline-block;
  position: relative;
  float: ${p => p.float || 'none'};
  font-size: 0.8em;
  margin-left: 0.5rem;
  margin-right: 0.25rem;
  border-radius: 0.5em;
  cursor: default;
  &:hover {
    border-radius: 0 0.5em 0.5em 0;
    cursor: ${p => p.onClick ? 'pointer' : 'default'};
  }
  &:hover ._label {
    display: block;
  }
  &.animate, &.animate ._label {
    animation: colorchange 3s infinite;
  }
  @keyframes colorchange {
    0% { background: ${p => p.color || 'gray'}; }
    50% { background: ${p => p.animate || 'black'}; }
    100% { background: ${p => p.color || 'gray'}; }
  }
`;

const Label = styled.div`
  display: none;
  position: absolute;
  white-space: nowrap;
  padding-left: 5px;
  top: 0;
  right: 100%;
  border-radius: 0.5em 0 0 0.5em;
  background-color: ${p => p.color || 'gray'};
`;

const SlideLabel = (p) => (
  <Styled {...p} className={p.animate ? 'animate' : 'normal'} onClick={p.onClick || undefined}>
    {p.content}
    <Label {...p} className='_label'>{p.label}</Label>
  </Styled>
);  

export default SlideLabel;